/**
 * Tuklas AI - Application Server Entry Point
 * Full-stack Express server with Vite middleware in development and static serving in production.
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { dbService, fallbackStore, DatabaseUnavailableError, prisma, hasValidDatabaseUrl } from "./src/lib/db.ts";
import { hashPassword, verifyPassword } from "./src/lib/auth/password.ts";
import { createSessionToken, verifySessionToken, SessionPayload } from "./src/lib/auth/session.ts";
import { validateEmail, validatePassword, validateName, validateRole } from "./src/lib/auth/validation.ts";
import { canUserAccessPath } from "./src/lib/auth/rbac.ts";
import { validateAndExtractYouTube, YouTubeService } from "./src/lib/youtube.ts";
import { LessonStatus, UserRole } from "@prisma/client";
import { AITutorService } from "./src/lib/ai/tutor.ts";
import { PracticeQuestionGenerator } from "./src/lib/ai/practice-generator.ts";
import { MistakeAnalyzerService } from "./src/lib/ai/mistake-analyzer.ts";
import * as Misconceptions from "./src/lib/ai/misconceptions/service.ts";
import { AdaptiveEngine } from "./src/lib/adaptive/index.ts";
import { MasteryEngine } from "./src/lib/mastery/index.ts";
import { StudentDashboardService } from "./src/lib/dashboard/index.ts";
import { TeacherService, TeacherAIService } from "./src/lib/teacher/index.ts";
import { AssessmentService, ResearchService, ResearchExporter } from "./src/lib/research/index.ts";
import { validateProductionEnv, getSanitizedEnvStatus } from "./src/lib/env.ts";
import {
  loginRateLimiter,
  registerRateLimiter,
  submissionRateLimiter,
  aiEndpointRateLimiter,
  documentUploadRateLimiter,
  ttsRateLimiter,
} from "./src/lib/rate-limiter.ts";
import { synthesizeSpeech, isTtsEnabled, TtsError, type TtsLang } from "./src/lib/voice/gemini-tts.ts";
import { jsonParsingErrorHandler, centralizedErrorHandler } from "./src/lib/errors.ts";
import { safeLog } from "./src/lib/logger.ts";
import { extractDocumentContent } from "./src/lib/documents/document-extractor.ts";
import { validateDocumentMetadata, MAX_DOCUMENT_SIZE_BYTES } from "./src/lib/storage.ts";

dotenv.config();

// Verify environment invariants at startup
try {
  validateProductionEnv();
} catch (envError: any) {
  console.error("ENVIRONMENT VALIDATION FAILED:", envError.message);
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
const PORT = parseInt(process.env.PORT || "3000", 10);
const isProd = process.env.NODE_ENV === "production";

// Security Headers Middleware (LIM-05)
// Explicitly permits same-origin microphone access so Web Speech API works in Edge and Chrome.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
  if (isProd) {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; ")
    );
  }
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  if (isProd || isHttps) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Same-Origin CSRF Protection Middleware for Mutating API Requests (LIM-04)
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (!mutatingMethods.has(req.method.toUpperCase())) {
    return next();
  }

  const sourceHeader = req.headers.origin || req.headers.referer;
  if (sourceHeader) {
    try {
      const sourceHost = new URL(sourceHeader).host.toLowerCase();
      const requestHost = (
        (req.headers["x-forwarded-host"] as string) ||
        req.headers.host ||
        ""
      )
        .split(",")[0]
        .trim()
        .toLowerCase();

      let allowedAppHost = "";
      if (process.env.APP_URL) {
        try {
          allowedAppHost = new URL(process.env.APP_URL).host.toLowerCase();
        } catch {
          // Ignore malformed APP_URL
        }
      }

      if (requestHost && sourceHost !== requestHost && sourceHost !== allowedAppHost) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Cross-origin state-changing request blocked by CSRF policy.",
        });
      }
    } catch {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Invalid Origin or Referer header.",
      });
    }
  }
  next();
});

const documentUploadPath = /^\/api\/lessons\/[^/]+\/documents\/?$/;
const smallJson = express.json({ limit: "1mb" });
const documentJson = express.json({ limit: "30mb" });
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST" && documentUploadPath.test(req.path)) {
    // Only teachers and admins may send a large body; everyone else is refused before it is read.
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }
    return documentJson(req, res, next);
  }
  return smallJson(req, res, next);
});
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(jsonParsingErrorHandler);

// Teacher documents (PDF/DOCX) keep their extracted text in `notes` for the AI tutor.
// That text is for teachers and the server-side tutor only, so non-staff never receive it.
function withoutDocumentText<T extends { resources?: any[] }>(lesson: T): T {
  if (!lesson?.resources) return lesson;
  return {
    ...lesson,
    resources: lesson.resources.map((r: any) =>
      r.type === "PDF" || r.type === "DOCUMENT" ? { ...r, notes: undefined } : r
    ),
  };
}

// Checkpoint and question blocks carry their answer key in metadata. Students never receive it:
// answers are graded on the server and revealed only in the response to an attempt.
const ANSWER_BLOCK_TYPES = new Set(["CHECKPOINT", "QUESTION"]);

function withoutAnswerKey(block: any) {
  if (!ANSWER_BLOCK_TYPES.has(block?.type) || !block.metadata) return block;
  try {
    const asString = typeof block.metadata === "string";
    const meta = asString ? JSON.parse(block.metadata) : { ...block.metadata };
    delete meta.correctAnswer;
    delete meta.explanation;
    return { ...block, metadata: asString ? JSON.stringify(meta) : meta };
  } catch {
    return block;
  }
}

// What a student, or a visitor who is not signed in, may receive for a lesson.
function forStudents<T extends { resources?: any[]; contentBlocks?: any[] }>(lesson: T): T {
  const safe = withoutDocumentText(lesson);
  return safe?.contentBlocks ? { ...safe, contentBlocks: safe.contentBlocks.map(withoutAnswerKey) } : safe;
}

// Curriculum outline for the signed-in user: staff see lessons (a teacher not other teachers' drafts),
// everyone else sees published lessons only, without lesson content.
function curriculumForUser(subjects: any[], session: SessionPayload | null) {
  const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");
  const visible = (l: any) => {
    if (!isStaff) return l.status === "PUBLISHED";
    return !(session!.role === "TEACHER" && l.status === "DRAFT" && l.authorId && l.authorId !== session!.userId);
  };
  return subjects.map((subj) => ({
    ...subj,
    grades: (subj.grades || []).map((g: any) => ({
      ...g,
      terms: (g.terms || []).map((t: any) => ({
        ...t,
        units: (t.units || []).map((u: any) => ({
          ...u,
          lessons: (u.lessons || [])
            .filter(visible)
            .map((l: any) => (isStaff ? l : { ...forStudents(l), contentBlocks: [] })),
        })),
      })),
    })),
  }));
}

// Practice sets that belong to a lesson are only open to students once that lesson is published.
async function practiceSetOpenToStudents(ps: { status?: string; lessonId?: string | null }): Promise<boolean> {
  if (ps.status !== "PUBLISHED") return false;
  if (!ps.lessonId) return true;
  const lesson: any = await dbService.getLessonById(ps.lessonId);
  return !!lesson && lesson.status === "PUBLISHED";
}

// Helper to extract session from Cookie or Bearer header
function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookieHeader = req.headers.cookie;
  let token: string | undefined;

  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      })
    );
    token = cookies["tuklas_session"];
  }

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split("Bearer ")[1];
  }

  if (!token) return null;
  return verifySessionToken(token);
}

// -------------------------------------------------------------
// API: AUTHENTICATION ROUTES
// -------------------------------------------------------------

app.post("/api/auth/register", registerRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    console.log("AUTH REGISTER START");
    const { name, email, password, gradeLevel } = req.body;

    const validatedEmail = validateEmail(email);
    const validatedPass = validatePassword(password);
    const validatedName = validateName(name);

    // Enforce STUDENT role for public self-registration (Teacher/Admin accounts are restricted)
    const assignedRole: UserRole = "STUDENT";

    // Check existing user by normalized email
    const existing = await dbService.findUserByEmail(validatedEmail);
    if (existing) {
      console.log("AUTH REGISTER DUPLICATE REJECTED:", validatedEmail);
      return res.status(409).json({ success: false, error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(validatedPass);
    const user = await dbService.createUser({
      name: validatedName,
      email: validatedEmail,
      passwordHash,
      role: assignedRole,
      gradeLevel: typeof gradeLevel === "number" ? gradeLevel : 7,
    });
    console.log("AUTH REGISTER DATABASE INSERT SUCCESS - userId:", user.id);

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    console.log("AUTH SESSION CREATED");

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie("tuklas_session", token, {
      httpOnly: true,
      secure: isHttps || isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error: unknown) {
    console.error("Register error:", error);
    if (error instanceof DatabaseUnavailableError) {
      return res.status(503).json({
        success: false,
        error: "Database service is temporarily unavailable. Please try again.",
      });
    }
    const message = error instanceof Error ? error.message : "Registration failed";
    return res.status(400).json({ success: false, error: message });
  }
});

app.post("/api/auth/login", loginRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const validatedEmail = validateEmail(email);
    const validatedPass = validatePassword(password);

    const user = await dbService.findUserByEmail(validatedEmail);
    if (!user) {
      console.log("AUTH LOGIN REJECTED: User not found");
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    console.log("AUTH LOGIN USER LOOKUP SUCCESS");

    const isValid = await verifyPassword(validatedPass, user.passwordHash);
    if (!isValid) {
      console.log("AUTH LOGIN REJECTED: Incorrect password");
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    console.log("AUTH LOGIN PASSWORD CHECK SUCCESS");

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    console.log("AUTH SESSION CREATED");

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie("tuklas_session", token, {
      httpOnly: true,
      secure: isHttps || isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error: unknown) {
    console.error("Login error:", error);
    if (error instanceof DatabaseUnavailableError) {
      return res.status(503).json({
        success: false,
        error: "Database service is temporarily unavailable. Please try again.",
      });
    }
    const message = error instanceof Error ? error.message : "Login failed";
    return res.status(400).json({ success: false, error: message });
  }
});

// Development-Only Quick Login Route (Strictly disabled in production — LIM-01)
app.post("/api/auth/dev-quick-login", loginRateLimiter.middleware(), async (req: Request, res: Response) => {
  if (isProd || process.env.ENABLE_DEV_QUICK_LOGIN === "false") {
    return res.status(404).json({
      success: false,
      error: "Development quick login is disabled in production.",
    });
  }

  try {
    const requestedRole = String(req.body?.role || "STUDENT").toUpperCase();
    const roleEmailMap: Record<string, string> = {
      STUDENT: "student@tuklas.ai",
      TEACHER: "teacher@tuklas.ai",
      ADMIN: "admin@tuklas.ai",
      RESEARCHER: "student@tuklas.ai",
    };

    const targetEmail = roleEmailMap[requestedRole];
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: "Unsupported development role." });
    }

    const user = await dbService.findUserByEmail(targetEmail);
    if (!user) {
      return res.status(404).json({ success: false, error: "Development test account not found." });
    }

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie("tuklas_session", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Development quick login failed";
    return res.status(500).json({ success: false, error: message });
  }
});

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  const isHttps = _req.secure || _req.headers["x-forwarded-proto"] === "https";
  res.clearCookie("tuklas_session", {
    httpOnly: true,
    path: "/",
    secure: isHttps || isProd,
    sameSite: "lax",
  });
  return res.json({ success: true, message: "Logged out successfully" });
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ success: false, user: null, error: "No active session" });
    }
    console.log("AUTH SESSION VERIFIED");

    // Verify against database that user still exists
    const user = await dbService.findUserById(session.userId);
    if (!user) {
      const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
      res.clearCookie("tuklas_session", {
        httpOnly: true,
        path: "/",
        secure: isHttps || isProd,
        sameSite: "lax",
      });
      return res.status(401).json({ success: false, user: null, error: "User record not found" });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error("Auth me error:", error);
    if (error instanceof DatabaseUnavailableError) {
      return res.status(503).json({
        success: false,
        user: null,
        error: "Database service is temporarily unavailable. Please try again.",
      });
    }
    return res.status(500).json({ success: false, user: null, error: "Authentication check failed" });
  }
});

// -------------------------------------------------------------
// API: DATABASE & CURRICULUM VERIFICATION ROUTES
// -------------------------------------------------------------

app.get("/api/health", async (req: Request, res: Response) => {
  const status = await dbService.getStatus();
  const session = getSessionFromRequest(req);
  const isAdmin = session?.role === "ADMIN";
  const healthy = status.connected;
  // Load balancers and uptime checks need a failing status code when the database is down.
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    database: isAdmin ? status : { connected: status.connected, provider: status.provider },
    ...(isAdmin ? { environment: getSanitizedEnvStatus() } : {}),
    timestamp: new Date().toISOString(),
    version: "0.2.0-pilot",
  });
});

app.get("/api/curriculum", async (req: Request, res: Response) => {
  try {
    const curriculum = await dbService.getCurriculum();
    return res.json({ data: curriculumForUser(curriculum, getSessionFromRequest(req)) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load curriculum";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/lessons", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    // Non-staff and unauthenticated visitors can only list PUBLISHED lessons
    const status = (isStaff ? req.query.status : "PUBLISHED") as LessonStatus | undefined;
    const unitId = req.query.unitId as string | undefined;
    let lessons: any[] = await dbService.getLessons({ status, unitId });

    // Teachers cannot see another teacher's DRAFT lessons (unless ADMIN)
    if (session?.role === "TEACHER") {
      lessons = lessons.filter(
        (l) => !(l.status === "DRAFT" && l.authorId && l.authorId !== session.userId)
      );
    }
    return res.json({ data: isStaff ? lessons : lessons.map(forStudents) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load lessons";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/lessons/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    // Non-staff and unauthenticated visitors can only view PUBLISHED lessons
    if (!isStaff && lesson.status !== "PUBLISHED") {
      return res.status(403).json({
        error: "Forbidden: This lesson has not been published yet.",
      });
    }

    // Teachers can only view their own DRAFT lessons (unless ADMIN)
    if (session?.role === "TEACHER" && lesson.status === "DRAFT" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to view another teacher's draft lesson.",
      });
    }

    return res.json({ data: isStaff ? lesson : forStudents(lesson) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve lesson";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Only teachers or admins can create lessons" });
    }

    const {
      title,
      description,
      unitId,
      termId,
      termNumber,
      newUnitTitle,
      newUnitDescription,
      learningObjectives,
      estimatedMinutes,
      skillIds,
    } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Lesson title is required" });
    }
    if ((!unitId || typeof unitId !== "string") && (!newUnitTitle || typeof newUnitTitle !== "string" || !newUnitTitle.trim())) {
      return res.status(400).json({ error: "Curriculum Unit or New Unit Title is required" });
    }

    const lesson = await dbService.createLesson({
      title: title.trim(),
      description: description?.trim(),
      unitId: typeof unitId === "string" ? unitId.trim() : undefined,
      termId: typeof termId === "string" ? termId.trim() : undefined,
      termNumber: typeof termNumber === "number" ? termNumber : undefined,
      newUnitTitle: typeof newUnitTitle === "string" ? newUnitTitle.trim() : undefined,
      newUnitDescription: typeof newUnitDescription === "string" ? newUnitDescription.trim() : undefined,
      authorId: session.userId,
      learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : [],
      estimatedMinutes: typeof estimatedMinutes === "number" ? estimatedMinutes : 20,
      skillIds: Array.isArray(skillIds) ? skillIds : [],
    });

    return res.status(201).json({ data: lesson });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/units", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Only teachers or admins can create units" });
    }

    const { termId, title, description, sequenceOrder } = req.body;
    if (!termId || typeof termId !== "string") {
      return res.status(400).json({ error: "Academic Term is required" });
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Unit title is required" });
    }

    const unit = await dbService.createUnit({
      termId: termId.trim(),
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : undefined,
      sequenceOrder: typeof sequenceOrder === "number" ? sequenceOrder : undefined,
    });

    return res.status(201).json({ data: unit });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create unit";
    return res.status(500).json({ error: message });
  }
});

app.put("/api/lessons/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Only teachers or admins can edit lessons" });
    }

    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to edit another teacher's lesson" });
    }

    const { title, description, unitId, learningObjectives, estimatedMinutes, resources, contentBlocks, skillIds } = req.body;

    const updated = await dbService.updateLesson(id, {
      title,
      description,
      unitId: typeof unitId === "string" ? unitId.trim() : undefined,
      learningObjectives,
      estimatedMinutes,
      resources,
      contentBlocks,
      skillIds,
    });

    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update lesson";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons/:id/status", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin credentials required" });
    }

    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to change status of another teacher's lesson" });
    }

    const { targetStatus } = req.body;
    if (!targetStatus) {
      return res.status(400).json({ error: "Target status is required" });
    }

    const result = await dbService.updateLessonStatus(id, targetStatus as LessonStatus, session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ data: result.lesson });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to transition lesson status";
    return res.status(500).json({ error: message });
  }
});

app.delete("/api/lessons/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Only teachers or admins can delete lessons" });
    }

    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to delete another teacher's lesson" });
    }

    await dbService.deleteLesson(id, session.role);
    return res.json({ success: true, message: "Lesson deleted successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete lesson";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 13: MATHISIPAN / YOUTUBE VIDEO INTEGRATION
// -------------------------------------------------------------

app.get("/api/youtube/search", async (req: Request, res: Response) => {
  try {
    const { query, grade, term, limit } = req.query;
    const response = await YouTubeService.searchVideos({
      query: query as string,
      gradeLevel: grade ? Number(grade) : undefined,
      termNumber: term ? Number(term) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return res.json({ data: response });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search videos";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/youtube/validate", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const result = await YouTubeService.validateAndPreview(url);
    if (!result.isValid) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to validate URL";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons/:id/video", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { title, url, youtubeId, notes, metadata, channelName, thumbnailUrl, description, duration } = req.body;

    if (!url && !youtubeId) {
      return res.status(400).json({ error: "Video URL or YouTube ID is required." });
    }

    // Validate and resolve ID
    const validated = await YouTubeService.validateAndPreview(url || youtubeId);
    if (!validated.isValid || !validated.videoId) {
      return res.status(400).json({ error: validated.error || "Invalid YouTube video resource." });
    }

    const resource = await dbService.attachLessonVideo(
      id,
      {
        title: title || validated.title || "Mathisipan Educational Video",
        url: validated.canonicalUrl || url,
        youtubeId: validated.videoId,
        provider: "YOUTUBE",
        channelName: channelName || validated.channelName || "Mathisipan",
        thumbnailUrl: thumbnailUrl || validated.thumbnailUrl || `https://img.youtube.com/vi/${validated.videoId}/hqdefault.jpg`,
        description: description || undefined,
        duration: duration || undefined,
        status: "APPROVED",
        addedBy: session.userId,
        notes,
        metadata,
      },
      session.role,
      session.userId
    );

    return res.status(201).json({ data: resource });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to attach video resource";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

app.delete("/api/lessons/:id/video/:resourceId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id, resourceId } = req.params;
    await dbService.removeLessonVideo(id, resourceId, session.role, session.userId);
    return res.json({ success: true, message: "Video resource removed successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove video resource";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 22: TEACHER MATERIAL INTELLIGENCE & DOCUMENT MANAGEMENT
// -------------------------------------------------------------

/**
 * Upload and extract text from teacher PDF or DOCX material.
 * Supports Base64 encoded file payloads and validates MIME types, size limits, and RBAC.
 */
app.post("/api/lessons/:id/documents", documentUploadRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { fileName, fileContent, fileSize, title, description, notes, mimeType } = req.body;

    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ error: "File name is required." });
    }

    // 1. Validate Document Metadata & Extension
    const sizeInBytes = typeof fileSize === "number" ? fileSize : (fileContent ? Buffer.byteLength(fileContent, "base64") : 0);
    const metaVal = validateDocumentMetadata({
      name: fileName,
      type: mimeType || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      size: sizeInBytes,
    });

    if (!metaVal.isValid) {
      return res.status(400).json({ error: metaVal.error || "Invalid document format or size." });
    }

    // Supported formats for teacher documents and materials
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const allowedDocExts = ["pdf", "docx", "pptx", "xlsx", "csv", "tsv", "txt", "text", "md", "markdown", "png", "jpg", "jpeg"];
    if (!allowedDocExts.includes(ext)) {
      return res.status(400).json({
        error: `Unsupported file format (.${ext}). Supported formats: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, PNG, JPG.`,
      });
    }

    if (!fileContent) {
      return res.status(400).json({ error: "Empty file content received." });
    }

    // Convert file content from base64 (or buffer string)
    let buffer: Buffer;
    try {
      const cleanBase64 = typeof fileContent === "string" ? fileContent.replace(/^data:.*?;base64,/, "") : "";
      buffer = Buffer.from(cleanBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64 document payload." });
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: "Empty or zero-byte document received." });
    }

    if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
      return res.status(400).json({
        error: `File size exceeds the 25MB limit (current: ${(buffer.length / (1024 * 1024)).toFixed(1)}MB).`,
      });
    }

    // 2. Extract Document Content (PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, Images)
    const extractResult = await extractDocumentContent({
      buffer,
      fileName,
      mimeType,
    });

    // 3. Attach Document Resource in DB
    const isSuccess = extractResult.success && extractResult.status === "READY";
    const status = isSuccess ? "READY" : "FAILED";
    const extractionPayload = isSuccess
      ? extractResult.data
      : {
          extractionStatus: "FAILED",
          charCount: 0,
          wordCount: 0,
          sectionCount: 0,
          previewText: "",
          extractedText: "",
          chunks: [],
          extractedAt: new Date().toISOString(),
          error: extractResult.error || "Text extraction failed.",
        };

    const docType = ext === "pdf" ? "PDF" : ["png", "jpg", "jpeg", "webp"].includes(ext) ? "IMAGE" : "DOCUMENT";

    const resource = await dbService.attachLessonDocument(
      id,
      {
        title: title || fileName,
        fileName,
        fileSize: buffer.length,
        type: docType,
        extractionData: extractionPayload,
        status,
        description,
        notes: notes || undefined,
        addedBy: session.userId,
      },
      session.role,
      session.userId
    );

    return res.status(201).json({
      success: true,
      data: resource,
      extraction: extractionPayload,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process document";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

/**
 * List all documents associated with a lesson
 */
app.get("/api/lessons/:id/documents", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }

    const { id } = req.params;
    const documents = await dbService.getLessonDocuments(id, session.role, session.userId);

    // Format document list with extraction metadata
    const formatted = documents.map((doc: any) => {
      let meta: any = null;
      if (doc.notes) {
        try {
          meta = JSON.parse(doc.notes);
        } catch {
          // Plain text notes
        }
      }
      return {
        id: doc.id,
        lessonId: doc.lessonId,
        type: doc.type,
        title: doc.title,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        status: doc.status || meta?.extractionStatus || "READY",
        charCount: meta?.charCount,
        sectionCount: meta?.sectionCount || meta?.chunks?.length,
        previewText: meta?.previewText,
        error: meta?.error,
        createdAt: doc.createdAt,
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve documents";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

/**
 * Get preview and full extracted text for a specific lesson document
 */
app.get("/api/lessons/:id/documents/:resourceId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }

    const { id, resourceId } = req.params;
    const doc = await dbService.getLessonDocumentById(id, resourceId, session.role, session.userId);

    let meta: any = null;
    if (doc.notes) {
      try {
        meta = JSON.parse(doc.notes);
      } catch {
        meta = { previewText: doc.notes };
      }
    }

    return res.json({
      success: true,
      data: {
        id: doc.id,
        lessonId: doc.lessonId,
        type: doc.type,
        title: doc.title,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        status: doc.status || meta?.extractionStatus || "READY",
        charCount: meta?.charCount,
        wordCount: meta?.wordCount,
        sectionCount: meta?.sectionCount || meta?.chunks?.length,
        previewText: meta?.previewText,
        chunks: meta?.chunks || [],
        error: meta?.error,
        createdAt: doc.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve document details";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

/**
 * Remove a teacher document resource from a lesson
 */
app.delete("/api/lessons/:id/documents/:resourceId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id, resourceId } = req.params;
    await dbService.removeLessonDocument(id, resourceId, session.role, session.userId);
    return res.json({ success: true, message: "Document resource removed successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove document resource";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

app.post("/api/student/lessons/:id/video-event", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }

    const { id } = req.params;
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: "videoId is required." });
    }

    const result = await dbService.recordVideoOpenedEvent(session.userId, id, videoId);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record video event";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 4: LEARNING PATH & PREREQUISITES API
// -------------------------------------------------------------

app.get("/api/student/learning-path", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    let targetUserId = session.userId;
    if (session.role === "TEACHER" || session.role === "ADMIN") {
      const qStudentId = req.query.studentId as string;
      if (qStudentId) {
        const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, qStudentId, session.role);
        if (!isAuth) {
          return res.status(403).json({ error: "Forbidden: Not authorized for this student." });
        }
        targetUserId = qStudentId;
      }
    } else if (session.role === "STUDENT") {
      targetUserId = session.userId;
    }
    const pathData = await dbService.getStudentLearningPath(targetUserId);
    return res.json({ data: pathData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load learning path";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/student/lessons/:id/access", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;
    const access = await dbService.getLessonAccess(userId, id, session.role);
    return res.json({ data: access });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to verify lesson access";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/student/progress", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required to update progress" });
    }
    const { lessonId, action, completedBlockIndex, totalBlocks } = req.body;
    if (!lessonId || !action) {
      return res.status(400).json({ error: "lessonId and action are required" });
    }

    const updated = await dbService.updateStudentProgress(session.userId, lessonId, {
      action,
      completedBlockIndex,
      totalBlocks,
    });

    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update progress";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/units/:unitId/reorder-lessons", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { unitId } = req.params;
    const { orderedLessonIds } = req.body;
    if (!Array.isArray(orderedLessonIds)) {
      return res.status(400).json({ error: "orderedLessonIds must be an array of strings" });
    }

    const result = await dbService.reorderLessons(unitId, orderedLessonIds, session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reorder lessons";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/skills/:skillId/prerequisites", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { skillId } = req.params;
    const { prerequisiteSkillIds } = req.body;
    if (!Array.isArray(prerequisiteSkillIds)) {
      return res.status(400).json({ error: "prerequisiteSkillIds must be an array of strings" });
    }

    const result = await dbService.updateSkillPrerequisites(skillId, prerequisiteSkillIds, session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update skill prerequisites";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 5: INTERACTIVE LESSON SESSIONS & CHECKPOINTS
// -------------------------------------------------------------

app.get("/api/student/lessons/:id/session", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;

    const lessonSession = await dbService.getLessonSession(userId, id);
    const attempts = await dbService.getCheckpointAttempts(userId, id);

    let nextLessonInfo: any = null;
    try {
      const pathData = await dbService.getStudentLearningPath(userId);
      const currentIndex = pathData.learningPath.findIndex((n: any) => n.lessonId === id);
      if (currentIndex !== -1 && currentIndex < pathData.learningPath.length - 1) {
        const currentLessonNode = pathData.learningPath.find((n: any) => n.lessonId === id);
        const currentUnitId = currentLessonNode?.unitId;
        const currentSubjectId = currentLessonNode?.subjectId;

        const subsequentLessons = pathData.learningPath.slice(currentIndex + 1);
        const nextCandidate =
          subsequentLessons.find((n: any) => {
            if (currentUnitId && n.unitId === currentUnitId) return true;
            if (currentSubjectId && n.subjectId === currentSubjectId) return true;
            return false;
          }) || subsequentLessons[0];
        if (nextCandidate) {
          nextLessonInfo = {
            lessonId: nextCandidate.lessonId,
            title: nextCandidate.title,
            state: nextCandidate.state,
            eligible: nextCandidate.state === "AVAILABLE" || nextCandidate.state === "IN_PROGRESS",
            lockReasons: nextCandidate.lockReasons || [],
          };
        }
      }
    } catch (pathErr) {
      console.warn("Failed to compute next eligible lesson on get session:", pathErr);
    }

    return res.json({
      data: {
        session: lessonSession,
        attempts,
        nextLesson: nextLessonInfo,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch lesson session";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/student/lessons/:id/session", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;
    const { currentSectionIndex, completedBlockIds, isCompleted } = req.body;

    const updated = await dbService.saveLessonSession(userId, id, {
      currentSectionIndex,
      completedBlockIds,
      isCompleted,
    });

    // If marked completed, update student progress record and compute next eligible lesson
    let nextLessonInfo: any = null;
    if (isCompleted) {
      await dbService.updateStudentProgress(userId, id, { action: "COMPLETE" });
      try {
        const pathData = await dbService.getStudentLearningPath(userId);
        const currentIndex = pathData.learningPath.findIndex((n: any) => n.lessonId === id);
        if (currentIndex !== -1 && currentIndex < pathData.learningPath.length - 1) {
          const currentLessonNode = pathData.learningPath.find((n: any) => n.lessonId === id);
          const currentUnitId = currentLessonNode?.unitId;
          const currentSubjectId = currentLessonNode?.subjectId;

          const subsequentLessons = pathData.learningPath.slice(currentIndex + 1);
          const nextCandidate =
            subsequentLessons.find((n: any) => {
              if (currentUnitId && n.unitId === currentUnitId) return true;
              if (currentSubjectId && n.subjectId === currentSubjectId) return true;
              return false;
            }) || subsequentLessons[0];
          if (nextCandidate) {
            nextLessonInfo = {
              lessonId: nextCandidate.lessonId,
              title: nextCandidate.title,
              state: nextCandidate.state,
              eligible: nextCandidate.state === "AVAILABLE" || nextCandidate.state === "IN_PROGRESS",
              lockReasons: nextCandidate.lockReasons || [],
            };
          }
        }
      } catch (pathErr) {
        console.warn("Failed to compute next eligible lesson on completion:", pathErr);
      }
    }

    return res.json({
      data: {
        ...(typeof updated === "object" ? updated : { updated }),
        nextLesson: nextLessonInfo,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update lesson session";
    return res.status(500).json({ error: message });
  }
});

app.post(["/api/student/lessons/:id/checkpoint", "/api/student/lessons/:id/checkpoints"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;
    const { blockId, answer } = req.body;

    if (!blockId || answer === undefined || typeof answer !== "string" || answer.length > 500) {
      return res.status(400).json({ error: "blockId and a short text answer are required" });
    }

    // Grade on the server: the client's claim of correctness is never trusted.
    const lesson: any = await dbService.getLessonById(id);
    const block = lesson?.contentBlocks?.find((b: any) => b.id === blockId);
    if (!lesson || !block || !ANSWER_BLOCK_TYPES.has(block.type)) {
      return res.status(404).json({ error: "Checkpoint not found in this lesson." });
    }
    if (session.role === "STUDENT" && lesson.status !== "PUBLISHED") {
      return res.status(403).json({ error: "This lesson has not been published yet." });
    }
    let meta: any = {};
    try {
      meta = typeof block.metadata === "string" ? JSON.parse(block.metadata) : block.metadata || {};
    } catch {
      meta = {};
    }
    const correctAnswer = String(meta.correctAnswer ?? "");
    if (!correctAnswer) {
      return res.status(422).json({ error: "This checkpoint has no answer key yet." });
    }
    const norm = (v: string) => v.trim().toLowerCase();
    const isCorrect = norm(answer) === norm(correctAnswer);
    const feedback = String(meta.explanation ?? "");

    const attempt = await dbService.submitCheckpointAttempt({
      userId,
      lessonId: id,
      blockId,
      answer,
      isCorrect,
      feedback,
    });

    // A wrong checkpoint answer is evidence too: refresh the student's mistake analysis in the background.
    if (!isCorrect && session.role === "STUDENT") {
      const skillId = lesson?.skills?.[0]?.skillId || lesson?.skills?.[0]?.skill?.id;
      if (skillId) {
        MistakeAnalyzerService.analyzeStudentMistakes({ studentId: userId, skillId, lessonId: id, trigger: "N_NEW_ATTEMPTS" }).catch((err) =>
          console.warn("Background checkpoint analysis error:", err)
        );
      }
    }

    return res.json({ data: attempt, result: { isCorrect, feedback, correctAnswer } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record checkpoint attempt";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons/:id/blocks", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id } = req.params;
    const { type, title, content, metadata } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: "Block type and content are required" });
    }

    const block = await dbService.addContentBlock(id, {
      type,
      title,
      content,
      metadata,
    });

    return res.status(201).json({ data: block });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add block";
    return res.status(500).json({ error: message });
  }
});

app.put("/api/lessons/:id/blocks/:blockId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id, blockId } = req.params;
    const { type, title, content, metadata } = req.body;

    const block = await dbService.updateContentBlock(id, blockId, {
      type,
      title,
      content,
      metadata,
    });

    return res.json({ data: block });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update block";
    return res.status(500).json({ error: message });
  }
});

app.delete("/api/lessons/:id/blocks/:blockId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id, blockId } = req.params;
    await dbService.deleteContentBlock(id, blockId);

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete block";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons/:id/reorder-blocks", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id } = req.params;
    const { orderedBlockIds } = req.body;

    if (!Array.isArray(orderedBlockIds)) {
      return res.status(400).json({ error: "orderedBlockIds must be an array of strings" });
    }

    const result = await dbService.reorderContentBlocks(id, orderedBlockIds);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reorder blocks";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/skills", async (_req: Request, res: Response) => {
  try {
    const skills = await dbService.getSkills();
    return res.json({ data: skills });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load skills";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 6: QUESTION MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// List questions with filtering
app.get("/api/questions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { skillId, lessonId, difficulty, status, type, search, source } = req.query;

    // Students can ONLY view published questions
    const effectiveStatus = isStaff ? (status as any) : "PUBLISHED";

    const questions = await dbService.getQuestions({
      skillId: skillId as string,
      lessonId: lessonId as string,
      difficulty: difficulty as any,
      status: effectiveStatus,
      type: type as any,
      search: search as string,
      source: source as any,
    });

    // If student, redact answers
    const payload = isStaff
      ? questions
      : questions.map((q) => dbService.getQuestionById(q.id, true));

    return res.json({ data: await Promise.resolve(payload) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch questions";
    return res.status(500).json({ error: message });
  }
});

// Create question (Teacher/Admin only)
app.post("/api/questions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const {
      lessonId,
      skillId,
      type,
      prompt,
      explanation,
      difficulty,
      status,
      source,
      questionData,
      metadata,
      correctFeedback,
      incorrectFeedback,
      allowRetry,
      maxAttempts,
    } = req.body;

    if (!type || !prompt) {
      return res.status(400).json({ error: "Question type and prompt are required." });
    }

    const question = await dbService.createQuestion(
      {
        lessonId,
        skillId,
        type,
        prompt,
        explanation,
        difficulty,
        status: status || "DRAFT",
        source: source || "TEACHER",
        questionData: questionData || {},
        metadata,
        correctFeedback,
        incorrectFeedback,
        allowRetry,
        maxAttempts,
      },
      session.userId
    );

    return res.status(201).json({ data: question });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create question";
    return res.status(500).json({ error: message });
  }
});

// Get single question by ID
app.get("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { id } = req.params;
    const question = await dbService.getQuestionById(id, !isStaff);

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Students cannot view unpublished questions
    if (!isStaff && question.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Question not found" });
    }

    return res.json({ data: question });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch question";
    return res.status(500).json({ error: message });
  }
});

// Update question (Teacher/Admin only)
app.patch("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const updated = await dbService.updateQuestion(id, req.body, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question";
    return res.status(500).json({ error: message });
  }
});

app.put("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const updated = await dbService.updateQuestion(id, req.body, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question";
    return res.status(500).json({ error: message });
  }
});

// Delete question (Teacher/Admin only)
app.delete("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    await dbService.deleteQuestion(id);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete question";
    return res.status(500).json({ error: message });
  }
});

// Update question status (Review workflow)
app.post("/api/questions/:id/status", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid question status." });
    }

    const updated = await dbService.updateQuestionStatus(id, status, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question status";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 6: PRACTICE SETS ENDPOINTS
// -------------------------------------------------------------

// List practice sets
app.get("/api/practice-sets", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { lessonId, skillId, status } = req.query;
    const effectiveStatus = isStaff ? (status as any) : "PUBLISHED";

    const practiceSets = await dbService.getPracticeSets({
      lessonId: lessonId as string,
      skillId: skillId as string,
      status: effectiveStatus,
    });

    if (!isStaff) {
      const open = await Promise.all((practiceSets as any[]).map((ps) => practiceSetOpenToStudents(ps)));
      return res.json({ data: (practiceSets as any[]).filter((_, i) => open[i]) });
    }
    return res.json({ data: practiceSets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice sets";
    return res.status(500).json({ error: message });
  }
});

// Create practice set (Teacher/Admin only)
app.post("/api/practice-sets", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { title, description, lessonId, skillId, status, questionIds } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Practice set title is required." });
    }

    const ps = await dbService.createPracticeSet(
      {
        title,
        description,
        lessonId,
        skillId,
        status: status || "DRAFT",
        questionIds: questionIds || [],
      },
      session.userId
    );

    return res.status(201).json({ data: ps });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create practice set";
    return res.status(500).json({ error: message });
  }
});

// Get single practice set
app.get("/api/practice-sets/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { id } = req.params;
    const ps = await dbService.getPracticeSetById(id, !isStaff);

    if (!ps) {
      return res.status(404).json({ error: "Practice set not found" });
    }

    if (!isStaff && !(await practiceSetOpenToStudents(ps))) {
      return res.status(404).json({ error: "Practice set is not published" });
    }

    return res.json({ data: ps });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice set";
    return res.status(500).json({ error: message });
  }
});

// Add question to practice set
app.post("/api/practice-sets/:id/questions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { questionId, order } = req.body;
    if (!questionId) {
      return res.status(400).json({ error: "questionId is required" });
    }

    await dbService.addQuestionToPracticeSet(id, questionId, order);
    const updated = await dbService.getPracticeSetById(id);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add question to practice set";
    return res.status(500).json({ error: message });
  }
});

// Remove question from practice set
app.delete("/api/practice-sets/:id/questions/:questionId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id, questionId } = req.params;
    await dbService.removeQuestionFromPracticeSet(id, questionId);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove question";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 6: PRACTICE EXECUTION & ATTEMPT TRACKING
// -------------------------------------------------------------

// Start practice session
app.post("/api/practice/start", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { practiceSetId } = req.body;

    if (!practiceSetId) {
      return res.status(400).json({ error: "practiceSetId is required" });
    }

    if (session.role === "STUDENT") {
      const ps: any = await dbService.getPracticeSetById(practiceSetId, true);
      if (!ps || !(await practiceSetOpenToStudents(ps))) {
        return res.status(404).json({ error: "Practice set not found or not published yet." });
      }
    }

    const practiceSession = await dbService.startPracticeSession(studentId, practiceSetId);
    return res.status(201).json({ data: practiceSession });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start practice session";
    return res.status(500).json({ error: message });
  }
});

// Get practice session state
app.get("/api/practice/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;

    const practiceSession = await dbService.getPracticeSession(id, studentId);
    if (!practiceSession) {
      return res.status(404).json({ error: "Practice session not found" });
    }

    return res.json({ data: practiceSession });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice session";
    return res.status(500).json({ error: message });
  }
});

// Submit answer for a question in a practice session
app.post("/api/practice/:id/answer", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;
    const { questionId, answer, timeTakenMs, hintUsed } = req.body;

    if (!questionId || answer === undefined) {
      return res.status(400).json({ error: "questionId and answer are required" });
    }

    const result = await dbService.submitQuestionAnswer({
      sessionId: id,
      questionId,
      answer,
      timeTakenMs,
      hintUsed,
      studentId,
    });

    // A wrong numeric answer may fit a known wrong idea: record it in the background (never delays the answer).
    if (result && (result as any).isCorrect === false) {
      dbService
        .getQuestionById(questionId, false)
        .then((q: any) => (q?.skillId ? Misconceptions.detect({ studentId, skillId: q.skillId, lessonId: q.lessonId }) : undefined))
        .catch((err) => console.warn("Background misconception detection failed:", err));
    }

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process question answer";
    return res.status(400).json({ error: message });
  }
});

// Complete practice session
app.post("/api/practice/:id/complete", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;

    const summary = await dbService.completePracticeSession(id, studentId);

    // Asynchronously trigger Mistake Analysis & Adaptive Recommendation on completed practice
    dbService.getPracticeSession(id, studentId).then((sess) => {
      if (sess) {
        const targetSkillId = sess.skillId || sess.practiceSet?.skillId;
        const targetLessonId = sess.lessonId || sess.practiceSet?.lessonId;
        MistakeAnalyzerService.analyzeStudentMistakes({
          studentId,
          skillId: targetSkillId,
          lessonId: targetLessonId,
          practiceSessionId: id,
          trigger: "PRACTICE_COMPLETED",
        })
          .then(() => {
            AdaptiveEngine.generateAdaptiveRecommendation({
              studentId,
              skillId: targetSkillId,
              lessonId: targetLessonId,
              trigger: "PRACTICE_COMPLETED",
              forceRefresh: true,
            }).catch((err) => console.warn("Background adaptive recommendation error:", err));

            if (targetSkillId) {
              MasteryEngine.evaluateSkillMastery({
                studentId,
                skillId: targetSkillId,
                forceRecalculate: true,
              }).catch((err) => console.warn("Background mastery evaluation error:", err));
            }
          })
          .catch((err) => console.warn("Background practice completion mistake analysis error:", err));
      }
    }).catch((e) => console.warn("Error loading session for mistake analysis:", e));

    return res.json({ data: summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete practice session";
    return res.status(500).json({ error: message });
  }
});

// Review practice session
app.get("/api/practice/:id/review", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;

    const review = await dbService.getPracticeSessionReview(id, studentId);
    return res.json({ data: review });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice session review";
    return res.status(500).json({ error: message });
  }
});

// Student practice history
app.get("/api/student/practice-history", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    let targetStudentId = session.userId;
    if (session.role === "TEACHER" || session.role === "ADMIN") {
      const qStudentId = req.query.studentId as string;
      if (qStudentId) {
        const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, qStudentId, session.role);
        if (!isAuth) {
          return res.status(403).json({ error: "Forbidden: Not authorized for this student." });
        }
        targetStudentId = qStudentId;
      }
    } else if (session.role === "STUDENT") {
      targetStudentId = session.userId;
    }

    const history = await dbService.getStudentPracticeHistory(targetStudentId);
    return res.json({ data: history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice history";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 7: AI TUTOR ENDPOINTS
// -------------------------------------------------------------

// Main AI Tutor interaction endpoint
app.post("/api/ai/tutor", aiEndpointRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to consult the AI Tutor." });
    }

    const {
      conversationId,
      lessonId,
      skillId,
      questionId,
      practiceSessionId,
      studentQuery,
      helpLevel,
      studentAnswer,
      blockId,
    } = req.body;

    const result = await AITutorService.interact({
      studentId: session.userId,
      conversationId,
      lessonId,
      skillId,
      questionId,
      practiceSessionId,
      studentQuery,
      helpLevel,
      studentAnswer,
      blockId: typeof blockId === "string" && blockId.length <= 100 ? blockId : undefined,
    });

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI Tutor request failed";

    if (message.includes("Rate limit exceeded")) {
      console.warn("AI Tutor rate limit notification:", message);
      return res.status(429).json({ error: message });
    }
    if (message.includes("disabled by your instructor")) {
      console.warn("AI Tutor disabled notification:", message);
      return res.status(403).json({ error: message });
    }

    console.error("AI Tutor endpoint error:", message);

    // Generic educational safe response for students on internal failure
    return res.status(500).json({
      error: "The AI Tutor is temporarily unavailable. You can continue the lesson and try again later.",
    });
  }
});

// The student answers a follow-up question the tutor put in front of them. Graded on the server; stored with the
// misconception, never as a practice attempt (mastery stays practice-only). Own rows only.
app.post("/api/student/misconceptions/:id/answer", aiEndpointRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }
    const answer = req.body?.answer;
    if (answer === undefined || answer === null || String(answer).trim() === "" || String(answer).length > 60) {
      return res.status(400).json({ error: "A short answer is required." });
    }
    const result = await Misconceptions.answerFollowUp({
      studentId: session.userId,
      misconceptionId: req.params.id,
      answer: String(answer),
      language: req.body?.language === "fil" ? "fil" : "en",
    });
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record the answer";
    return res.status(400).json({ error: message });
  }
});

// Teacher/Admin: suspected misconceptions for one student, with the evidence and the alternatives not ruled out.
app.get("/api/teacher/students/:studentId/misconceptions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }
    const { studentId } = req.params;
    if (!(await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role))) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student." });
    }
    const skillId = typeof req.query.skillId === "string" ? req.query.skillId : undefined;
    return res.json({ data: await Misconceptions.listForTeacher(studentId, skillId) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load misconceptions";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin: dismiss a suspected misconception, confirm it, or leave a note.
app.patch("/api/teacher/students/:studentId/misconceptions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }
    const { studentId, id } = req.params;
    if (!(await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role))) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to change this student's records." });
    }
    const { status, teacherNote } = req.body || {};
    if (status !== undefined && !["DISMISSED", "SUPPORTED", "SUSPECTED"].includes(status)) {
      return res.status(400).json({ error: "status must be DISMISSED, SUPPORTED or SUSPECTED." });
    }
    const updated = await Misconceptions.teacherUpdate(id, studentId, { status, teacherNote });
    if (!updated) {
      return res.status(404).json({ error: "Misconception not found for this student." });
    }
    return res.json({ data: { id: updated.id, status: updated.status, teacherNote: updated.teacherNote } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update the misconception";
    return res.status(500).json({ error: message });
  }
});

// Get AI conversation history (supports singular and plural for IDOR security)
app.get(["/api/ai/conversations/:id", "/api/ai/conversation/:id"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const conversation = await dbService.getAITutorConversation(id, session.userId);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found or access denied." });
    }

    return res.json({ data: conversation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load conversation";
    return res.status(500).json({ error: message });
  }
});

// Get AI Tutor Teacher Settings
app.get("/api/ai/settings", async (req: Request, res: Response) => {
  try {
    if (!getSessionFromRequest(req)) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const settings = await dbService.getTeacherAISettings();
    return res.json({ data: settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load AI settings";
    return res.status(500).json({ error: message });
  }
});

// Update AI Tutor Teacher Settings (Teacher/Admin only)
app.patch("/api/ai/settings", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const updated = await dbService.updateTeacherAISettings(req.body);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update AI settings";
    return res.status(500).json({ error: message });
  }
});

// Natural Filipino speech for the tutor (Gemini TTS). The browser falls back to its own voice on any error.
app.post("/api/ai/tts", ttsRateLimiter.middleware(), async (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Please sign in." });
  }
  if (!isTtsEnabled()) {
    return res.status(503).json({ error: "Natural speech is not available on this server." });
  }
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const lang: TtsLang = req.body?.lang === "en-PH" ? "en-PH" : "fil-PH";
  try {
    const wav = await synthesizeSpeech(text, lang);
    res.set({ "Content-Type": "audio/wav", "Cache-Control": "private, max-age=86400", "Content-Length": String(wav.length) });
    return res.send(wav);
  } catch (error: unknown) {
    if (error instanceof TtsError) return res.status(error.status).json({ error: error.message });
    return res.status(502).json({ error: "Speech generation failed." });
  }
});

// Phase 21: Content-Grounded Practice Question Generator
app.post("/api/ai/practice/generate", aiEndpointRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { lessonId, skillId, difficulty, questionType, targetMisconception, studentWeakness } = req.body;

    const result = await PracticeQuestionGenerator.generateQuestion({
      lessonId,
      skillId,
      difficulty,
      questionType,
      targetMisconception,
      studentWeakness,
      requestedByRole: session.role,
    });

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate practice question";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 8: AI MISTAKE ANALYZER ENDPOINTS
// -------------------------------------------------------------

// Student retrieves their own mistake analyses
app.get("/api/student/insights", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to view learning insights." });
    }

    const { skillId, limit } = req.query;
    const insights = await dbService.getMistakeAnalysesForStudent(session.userId, {
      skillId: skillId as string,
      limit: limit ? Number(limit) : 20,
    });

    return res.json({ data: insights });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load learning insights";
    return res.status(500).json({ error: message });
  }
});

// Student retrieves single mistake analysis
app.get("/api/student/insights/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const insight = await dbService.getMistakeAnalysisById(id, session.userId, session.role);
    if (!insight) {
      return res.status(404).json({ error: "Insight not found or access denied." });
    }

    if (session.role === "TEACHER" && insight.studentId !== session.userId) {
      const isAuth = await TeacherService.isTeacherAuthorizedForStudent(
        session.userId,
        insight.studentId,
        session.role
      );
      if (!isAuth) {
        return res.status(403).json({
          error: "Forbidden: You are not authorized to view this student's learning insight.",
        });
      }
    }

    return res.json({ data: insight });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load learning insight";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin retrieves mistake analyses for a student with evidence (LIM-10: Classroom ownership verified)
app.get("/api/teacher/students/:studentId/insights", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view insights for this student." });
    }

    const { skillId, limit } = req.query;

    const insights = await dbService.getMistakeAnalysesForStudent(studentId, {
      skillId: skillId as string,
      limit: limit ? Number(limit) : 20,
      includeOutdated: true,
    });

    return res.json({ data: insights });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student insights";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin manually triggers learning pattern analysis for a student (LIM-06, LIM-10)
app.post("/api/teacher/students/:studentId/analyze", aiEndpointRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to analyze this student." });
    }

    const { skillId, lessonId, practiceSessionId, maxAttempts } = req.body;

    const analysis = await MistakeAnalyzerService.analyzeStudentMistakes({
      studentId,
      skillId,
      lessonId,
      practiceSessionId,
      trigger: "TEACHER_REQUESTED",
      forceRefresh: true,
      maxAttempts: maxAttempts ? Number(maxAttempts) : 10,
    });

    return res.json({ data: analysis });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Mistake analysis failed";
    console.error("Teacher analyze endpoint error:", message);
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 9: ADAPTIVE LEARNING ENGINE ENDPOINTS
// -------------------------------------------------------------

// Student retrieves active adaptive recommendation
app.get("/api/student/adaptive/recommendation", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to view adaptive guidance." });
    }

    const { skillId } = req.query;
    const recommendation = await AdaptiveEngine.generateAdaptiveRecommendation({
      studentId: session.userId,
      skillId: skillId as string | undefined,
      trigger: "STUDENT_REQUESTED",
    });

    return res.json({ data: recommendation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load adaptive recommendation";
    return res.status(500).json({ error: message });
  }
});

// Student forcefully generates / refreshes adaptive recommendation
app.post("/api/student/adaptive/recommendation/generate", submissionRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { skillId, lessonId } = req.body;
    const recommendation = await AdaptiveEngine.generateAdaptiveRecommendation({
      studentId: session.userId,
      skillId,
      lessonId,
      trigger: "STUDENT_REQUESTED",
      forceRefresh: true,
    });

    return res.json({ data: recommendation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate recommendation";
    return res.status(500).json({ error: message });
  }
});

// Student marks recommendation as completed
app.post("/api/student/adaptive/recommendation/:id/complete", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const updated = await AdaptiveEngine.completeRecommendation(id, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete recommendation";
    return res.status(500).json({ error: message });
  }
});

// Student dismisses recommendation
app.post("/api/student/adaptive/recommendation/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const updated = await AdaptiveEngine.dismissRecommendation(id, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to dismiss recommendation";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin retrieves recommendation history for a student
app.get("/api/teacher/students/:studentId/adaptive/recommendations", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's adaptive history." });
    }

    const { limit } = req.query;
    const list = await dbService.getStudentAdaptiveHistory(studentId, {
      limit: limit ? Number(limit) : 20,
    });

    return res.json({ data: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch student adaptive history";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin forces adaptive recommendation recalculation for a student
app.post("/api/teacher/students/:studentId/adaptive/recommendation", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to manage this student." });
    }

    const { skillId, lessonId } = req.body;
    const recommendation = await AdaptiveEngine.generateAdaptiveRecommendation({
      studentId,
      skillId,
      lessonId,
      trigger: "TEACHER_REQUESTED",
      forceRefresh: true,
    });

    return res.json({ data: recommendation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to recalculate recommendation";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin applies an override to an adaptive recommendation with reason
app.post("/api/teacher/students/:studentId/adaptive/override", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to manage this student." });
    }

    const {
      recommendationId,
      overrideDecision,
      reason,
      targetDifficulty,
      recommendedActivityType,
      recommendedActivityId,
    } = req.body;

    if (!recommendationId || !overrideDecision || !reason) {
      return res.status(400).json({ error: "recommendationId, overrideDecision, and reason are required." });
    }

    const updated = await AdaptiveEngine.applyTeacherOverride({
      recommendationId,
      teacherId: session.userId,
      overrideDecision,
      reason,
      targetDifficulty,
      recommendedActivityType,
      recommendedActivityId,
    });

    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record teacher override";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 10: MASTERY ENGINE ENDPOINTS
// -------------------------------------------------------------

// Student retrieves all their skill mastery snapshots
app.get("/api/student/mastery", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to view mastery status." });
    }

    const masteries = await MasteryEngine.getStudentMasteries(session.userId);
    return res.json({ data: masteries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch student mastery list";
    return res.status(500).json({ error: message });
  }
});

// Student retrieves single skill mastery evaluation
app.get("/api/student/mastery/:skillId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { skillId } = req.params;
    const mastery = await MasteryEngine.evaluateSkillMastery({
      studentId: session.userId,
      skillId,
      forceRecalculate: false,
    });

    return res.json({ data: mastery });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load skill mastery";
    return res.status(500).json({ error: message });
  }
});

// Student requests on-demand recalculation of mastery for a skill
app.post("/api/student/mastery/:skillId/recalculate", submissionRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { skillId } = req.params;
    const refreshed = await MasteryEngine.evaluateSkillMastery({
      studentId: session.userId,
      skillId,
      forceRecalculate: true,
      useAIExplanation: true,
    });

    return res.json({ data: refreshed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to recalculate mastery";
    return res.status(500).json({ error: message });
  }
});

// Teacher / Admin retrieves mastery across skills for an authorized student
app.get("/api/teacher/students/:studentId/mastery", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuthorized = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's mastery." });
    }

    const masteries = await MasteryEngine.getStudentMasteries(studentId);
    return res.json({ data: masteries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student mastery records";
    return res.status(500).json({ error: message });
  }
});

// Teacher / Admin inspects detailed mastery & evidence for a specific student and skill
app.get("/api/teacher/students/:studentId/mastery/:skillId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId, skillId } = req.params;
    const isAuthorized = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's mastery." });
    }

    const mastery = await MasteryEngine.evaluateSkillMastery({
      studentId,
      skillId,
      forceRecalculate: false,
    });

    return res.json({ data: mastery });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student skill mastery evidence";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 11: STUDENT DASHBOARD ENDPOINTS
// -------------------------------------------------------------

// Student retrieves comprehensive personalized dashboard payload
app.get("/api/student/dashboard", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in to access student dashboard." });
    }

    let targetStudentId = session.userId;
    if (session.role === "TEACHER" || session.role === "ADMIN") {
      const qStudentId = req.query.studentId as string;
      if (qStudentId) {
        const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, qStudentId, session.role);
        if (!isAuth) {
          return res.status(403).json({ error: "Forbidden: Not authorized to view this student's dashboard." });
        }
        targetStudentId = qStudentId;
      }
    } else if (session.role === "STUDENT") {
      targetStudentId = session.userId;
    }

    const dashboard = await StudentDashboardService.getStudentDashboard(targetStudentId);
    return res.json({ data: dashboard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student dashboard";
    console.error("Student dashboard error:", error);
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 12: TEACHER DASHBOARD, CLASS & STUDENT MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// Teacher retrieves primary dashboard analytics & control center
app.get("/api/teacher/dashboard", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator credentials required." });
    }

    const dashboard = await TeacherService.getTeacherDashboard(session.userId, session.role);
    return res.json({ data: dashboard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load teacher dashboard";
    console.error("Teacher dashboard API error:", error);
    return res.status(500).json({ error: message });
  }
});

// Teacher retrieves paginated list of authorized students with search
app.get("/api/teacher/students", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { search, classId, page, limit } = req.query;
    const paginated = await TeacherService.getAuthorizedStudentsPaginated(
      session.userId,
      session.role,
      {
        search: search as string,
        classId: classId as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      }
    );

    return res.json({ data: paginated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load students";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher inspects specific student detail with strict IDOR verification
app.get("/api/teacher/students/:studentId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { studentId } = req.params;
    const detail = await TeacherService.getStudentDetail(studentId, session.userId, session.role);
    return res.json({ data: detail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student detail";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher retrieves authorized classes
app.get("/api/teacher/classes", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const classes = await TeacherService.getAuthorizedClassrooms(session.userId, session.role);
    return res.json({ data: classes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load classes";
    return res.status(500).json({ error: message });
  }
});

// Teacher inspects specific class detail
app.get("/api/teacher/classes/:classId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { classId } = req.params;
    const classDetail = await TeacherService.getClassroomDetail(classId, session.userId, session.role);
    return res.json({ data: classDetail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load class detail";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher creates a class
app.post("/api/teacher/classes", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }
    const classroom = await TeacherService.createClassroom(session.userId, session.role, req.body || {});
    return res.status(201).json({ data: classroom });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create class";
    return res.status(message.includes("required") ? 400 : 500).json({ error: message });
  }
});

// Teacher enrolls a registered student by email
app.post("/api/teacher/classes/:classId/students", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }
    const student = await TeacherService.enrollStudentByEmail(req.params.classId, session.userId, session.role, req.body?.email);
    return res.status(201).json({ data: student });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to enroll student";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") || message.includes("No student") ? 404 : message.includes("required") ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher removes a student from a class
app.delete("/api/teacher/classes/:classId/students/:studentId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }
    await TeacherService.removeStudentFromClass(req.params.classId, session.userId, session.role, req.params.studentId);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove student";
    return res.status(message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500).json({ error: message });
  }
});

// Admin lists accounts
app.get("/api/admin/users", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Administrator access required." });
    }
    return res.json({ data: await dbService.listUsers() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list users";
    return res.status(500).json({ error: message });
  }
});

// Admin changes an account's role (an admin cannot change their own role, so the last admin is never locked out)
app.patch("/api/admin/users/:id/role", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Administrator access required." });
    }
    const role = String(req.body?.role || "").toUpperCase();
    if (!["STUDENT", "TEACHER", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "Role must be STUDENT, TEACHER or ADMIN." });
    }
    if (req.params.id === session.userId) {
      return res.status(400).json({ error: "You cannot change your own role." });
    }
    const updated = await dbService.updateUserRole(req.params.id, role as UserRole);
    safeLog.info("ADMIN ROLE CHANGE", { by: session.userId, target: updated.id, role: updated.role });
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    return res.status(message.includes("not found") ? 404 : 500).json({ error: message });
  }
});

// Teacher creates an assignment for a class
app.post("/api/teacher/classes/:classId/assignments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { classId } = req.params;
    const { title, description, lessonId, practiceSetId, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Assignment title is required." });
    }

    const assignment = await TeacherService.createAssignment(
      session.userId,
      { classroomId: classId, title, description, lessonId, practiceSetId, dueDate },
      session.role
    );

    return res.status(201).json({ data: assignment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create assignment";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher asks pedagogical questions to the Teacher AI Assistant
app.post("/api/teacher/ai-assistant", aiEndpointRateLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { prompt, classId } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "A valid prompt is required." });
    }

    const result = await TeacherAIService.queryTeacherAssistant({
      teacherId: session.userId,
      userRole: session.role,
      prompt,
      classId,
    });

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Teacher AI assistant failed";
    return res.status(500).json({ error: message });
  }
});

// Teacher publishes a lesson with ownership validation
app.post("/api/teacher/lessons/:id/publish", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { id } = req.params;
    const lesson: any = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    // Server-side ownership enforcement
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You can only publish your own lessons." });
    }

    const result = await dbService.updateLessonStatus(id, "PUBLISHED", session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ data: result.lesson, message: "Lesson successfully published." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to publish lesson";
    return res.status(500).json({ error: message });
  }
});

// Role-protected API route test
app.get("/api/admin/system-summary", (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: Administrator role required" });
  }
  return res.json({
    message: "Admin diagnostic authorization verified",
    serverUptime: process.uptime(),
    activeRole: session.role,
  });
});

// -------------------------------------------------------------
// PHASE 14: ASSESSMENT & RESEARCH ANALYTICS ENDPOINTS
// -------------------------------------------------------------

// Teacher creates assessment
app.post("/api/teacher/assessments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { title, description, type, lessonId, gradeLevel, timeLimitMinutes, passingScorePercent, questions } =
      req.body;

    const assessment = await AssessmentService.createAssessment(
      {
        title,
        description,
        type,
        lessonId,
        gradeLevel,
        timeLimitMinutes,
        passingScorePercent,
        questions: questions || [],
      },
      session.userId,
      session.role
    );

    return res.status(201).json({ data: assessment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create assessment";
    return res.status(400).json({ error: message });
  }
});

// Teacher/Admin lists assessments
app.get("/api/teacher/assessments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { type, status, gradeLevel, lessonId } = req.query;
    const list = await AssessmentService.listAssessments(
      {
        type: type as any,
        status: status as any,
        gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
        lessonId: lessonId as string | undefined,
      },
      session.userId,
      session.role
    );

    return res.json({ data: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list assessments";
    return res.status(500).json({ error: message });
  }
});

// Teacher publishes assessment
app.post("/api/teacher/assessments/:id/publish", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const published = await AssessmentService.publishAssessment(id, session.userId, session.role);
    return res.json({ data: published });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to publish assessment";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher assigns assessment to class
app.post("/api/teacher/assessments/:id/assign", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { classroomId, studentId, dueDate } = req.body;
    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required to assign assessment." });
    }

    const result = await AssessmentService.assignAssessment(
      id,
      classroomId,
      { studentId, dueDate },
      session.userId,
      session.role
    );

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to assign assessment";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Student lists available published assessments
app.get("/api/student/assessments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { type, gradeLevel } = req.query;
    const list = await AssessmentService.listAssessments(
      {
        type: type as any,
        gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      },
      session.userId,
      session.role
    );

    return res.json({ data: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve assessments";
    return res.status(500).json({ error: message });
  }
});

// Student gets assessment details (answers safely redacted!)
app.get("/api/student/assessments/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const assessment = await AssessmentService.getAssessmentForStudent(id, session.userId);
    return res.json({ data: assessment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get assessment";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Student starts assessment attempt
app.post("/api/student/assessments/:id/start", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const attempt = await AssessmentService.startAssessmentAttempt(id, session.userId);
    return res.status(201).json({ data: attempt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start assessment attempt";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Student submits assessment attempt (Server-Side Deterministic Grading)
app.post("/api/student/assessments/attempts/:attemptId/submit", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { attemptId } = req.params;
    const { responses } = req.body;

    if (!Array.isArray(responses)) {
      return res.status(400).json({ error: "responses must be an array of answers." });
    }

    const result = await AssessmentService.submitAssessmentAttempt(attemptId, session.userId, responses);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit assessment";
    const status = message.includes("Forbidden") ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Teacher/Admin views research profile for a student (IDOR scoped)
app.get(["/api/teacher/research/profile/:studentId", "/api/admin/research/profile/:studentId"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { studentId } = req.params;
    const isAuthorized = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's research profile." });
    }

    const profile = await ResearchService.getStudentResearchProfile(studentId);
    return res.json({ data: profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student research profile";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views Pre-Test vs Post-Test comparison
app.get(["/api/teacher/research/comparison", "/api/admin/research/comparison"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const preTestId = (req.query.preTestId as string) || "asm_pre_integers";
    const postTestId = (req.query.postTestId as string) || "asm_post_integers";
    const classroomId = req.query.classroomId as string | undefined;

    if (session.role === "TEACHER" && classroomId) {
      const classes = await TeacherService.getAuthorizedClassrooms(session.userId, session.role);
      if (!classes.some((c: any) => c.id === classroomId)) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to view this classroom's research comparison." });
      }
    }

    const comparison = await ResearchService.getPrePostComparison(preTestId, postTestId, classroomId);
    return res.json({ data: comparison });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to compute pre/post comparison";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views empirical Difficult Skills analysis
app.get(["/api/teacher/research/difficult-skills", "/api/admin/research/difficult-skills"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const gradeLevel = req.query.grade ? Number(req.query.grade) : undefined;
    const classroomId = req.query.classroomId as string | undefined;

    if (session.role === "TEACHER" && classroomId) {
      const classes = await TeacherService.getAuthorizedClassrooms(session.userId, session.role);
      if (!classes.some((c: any) => c.id === classroomId)) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to view this classroom's skill analytics." });
      }
    }

    const difficultSkills = await ResearchService.getDifficultSkills({ gradeLevel, classroomId });
    return res.json({ data: difficultSkills });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to analyze difficult skills";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views aggregate Mistake Analytics
app.get(["/api/teacher/research/mistakes", "/api/admin/research/mistakes"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const mistakes = await ResearchService.getMistakeAnalytics();
    return res.json({ data: mistakes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load mistake analytics";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views Intervention Observations (strictly non-causal)
app.get(["/api/teacher/research/interventions", "/api/admin/research/interventions"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const observations = await ResearchService.getInterventionObservations();
    return res.json({ data: observations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load intervention observations";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views longitudinal Time Series metrics
app.get(["/api/teacher/research/time-series", "/api/admin/research/time-series"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const timeSeries = await ResearchService.getTimeSeriesMetrics();
    return res.json({ data: timeSeries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load time series metrics";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin exports standardized research metrics CSV (LIM-08: Exports all authorized students)
app.get(["/api/teacher/research/export/metrics.csv", "/api/admin/research/export/metrics.csv"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const classroomId = req.query.classroomId as string | undefined;
    const { students: authorizedStudents } = await TeacherService.getAuthorizedStudentsPaginated(
      session.userId,
      session.role,
      { classId: classroomId, limit: 500 }
    );

    const studentIds = authorizedStudents.length > 0
      ? authorizedStudents.map((s) => s.id)
      : ["usr_student_01"];

    const profiles = await Promise.all(
      studentIds.map((studentId) => ResearchService.getStudentResearchProfile(studentId))
    );
    const csvData = ResearchExporter.exportMetricsSummaryCsv(profiles);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tuklas_research_metrics_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export metrics CSV";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin exports raw question attempt evidence CSV (LIM-08: Scoped to authorized students & real names)
app.get(["/api/teacher/research/export/attempts.csv", "/api/admin/research/export/attempts.csv"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const classroomId = req.query.classroomId as string | undefined;
    const { students: authorizedStudents } = await TeacherService.getAuthorizedStudentsPaginated(
      session.userId,
      session.role,
      { classId: classroomId, limit: 500 }
    );
    const authorizedStudentIdSet = new Set<string>(authorizedStudents.map((s) => s.id));
    const studentNameMap = new Map<string, string>(authorizedStudents.map((s) => [s.id, s.name]));

    let attempts: any[] = [];
    if (hasValidDatabaseUrl) {
      try {
        const whereClause = session.role === "ADMIN" && !classroomId
          ? {}
          : { studentId: { in: Array.from(authorizedStudentIdSet) } };

        const dbAttempts = await prisma.questionAttempt.findMany({
          where: whereClause,
          include: {
            question: true,
            student: true,
          },
          orderBy: { submittedAt: "desc" },
        });
        attempts = dbAttempts.map((a: any) => ({
          studentId: a.studentId,
          studentName: a.student?.name || studentNameMap.get(a.studentId) || a.studentId,
          questionId: a.questionId,
          skillId: a.skillId,
          attemptNumber: a.attemptNumber,
          isCorrect: a.isCorrect,
          difficulty: a.question?.difficulty || "MEDIUM",
          questionType: a.question?.type || "MULTIPLE_CHOICE",
          cognitiveLevel: a.question?.cognitiveLevel || "PROCEDURAL",
          timeTakenMs: a.timeTakenMs,
          hintUsed: !!a.hintUsed,
          submittedAt: a.submittedAt ? a.submittedAt.toISOString() : new Date().toISOString(),
        }));
      } catch (err) {
        console.warn("Attempts export db fallback:", err);
      }
    }

    if (attempts.length === 0) {
      const filteredFallback = fallbackStore.questionAttempts.filter((a: any) =>
        (session.role === "ADMIN" && !classroomId) || authorizedStudentIdSet.size === 0 || authorizedStudentIdSet.has(a.studentId)
      );
      attempts = filteredFallback.map((a: any) => {
        const q = fallbackStore.questions.find((fq: any) => fq.id === a.questionId) || ({} as any);
        const u = fallbackStore.users.find((fu: any) => fu.id === a.studentId);
        return {
          studentId: a.studentId,
          studentName: u?.name || studentNameMap.get(a.studentId) || a.studentId,
          questionId: a.questionId,
          skillId: a.skillId,
          attemptNumber: a.attemptNumber,
          isCorrect: a.isCorrect,
          difficulty: q.difficulty || "MEDIUM",
          questionType: q.type || "MULTIPLE_CHOICE",
          cognitiveLevel: q.cognitiveLevel || "PROCEDURAL",
          timeTakenMs: a.timeTakenMs,
          hintUsed: !!a.hintUsed,
          submittedAt: a.submittedAt,
        };
      });
    }

    const csvData = ResearchExporter.exportQuestionAttemptsCsv(attempts);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tuklas_question_attempts_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export attempts CSV";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin exports Pre/Post comparison CSV
app.get(["/api/teacher/research/export/comparison.csv", "/api/admin/research/export/comparison.csv"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const comparison = await ResearchService.getPrePostComparison("asm_pre_integers", "asm_post_integers");
    const csvData = ResearchExporter.exportPrePostComparisonCsv([comparison]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tuklas_pre_post_comparison_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export comparison CSV";
    return res.status(500).json({ error: message });
  }
});

// Centralized unhandled error handler middleware (must be registered after all API routes)
app.use(centralizedErrorHandler);

// -------------------------------------------------------------
// VITE DEVELOPMENT MIDDLEWARE OR STATIC SERVING
// -------------------------------------------------------------

async function startServer() {
  if (!isProd) {
    // Dynamically load Vite in development
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(import.meta.dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Tuklas AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
