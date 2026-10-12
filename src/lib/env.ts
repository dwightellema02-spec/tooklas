/**
 * Tuklas AI - Production Environment Validation & Configuration
 * Phase 14: Production Readiness, Reliability & Deployment Hardening
 *
 * Centralized environment validator ensuring production security invariants:
 * - DATABASE_URL: Required in production; must be a valid PostgreSQL connection string.
 * - AUTH_SECRET: Required in production; must be at least 32 characters for HMAC-SHA256 integrity.
 * - GEMINI_API_KEY: Optional; if missing, AI Tutor gracefully falls back to local Socratic engine.
 * - YOUTUBE_API_KEY: Optional; if missing, video search gracefully falls back to curated Mathisipan catalog.
 * - Secrets are strictly confined server-side and never exposed to the client or logs.
 */

import "dotenv/config";
import { validateAuthSecret } from "./auth/session";

export interface EnvValidationResult {
  isValid: boolean;
  isProduction: boolean;
  errors: string[];
  warnings: string[];
  status: {
    databaseConfigured: boolean;
    authSecretConfigured: boolean;
    geminiConfigured: boolean;
    youtubeConfigured: boolean;
    nodeEnv: string;
  };
}

const SUPPORTED_NON_PROD_ENVS = new Set(["development", "test"]);

/**
 * Validates the runtime environment according to deployment target (Production vs Development/Testing).
 * In production mode or unknown environments, throws an Error if critical invariants are violated.
 */
export function validateProductionEnv(opts?: { strict?: boolean }): EnvValidationResult {
  const rawNodeEnv = process.env.NODE_ENV;
  const nodeEnv = rawNodeEnv ? rawNodeEnv.trim().toLowerCase() : "unspecified";
  const isExplicitDevOrTest = SUPPORTED_NON_PROD_ENVS.has(nodeEnv);
  const isProd = nodeEnv === "production";
  
  // Fail-closed: strict is true if explicitly set, if in production, or if NODE_ENV is unset/unrecognized
  const strict = opts?.strict ?? (!isExplicitDevOrTest);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawNodeEnv) {
    if (strict) {
      errors.push(
        "NODE_ENV is not set. The environment must be explicitly defined (production, development, or test)."
      );
    } else {
      warnings.push("NODE_ENV is unset; defaulting to non-strict dev mode.");
    }
  } else if (!SUPPORTED_NON_PROD_ENVS.has(nodeEnv) && !isProd) {
    if (strict) {
      errors.push(
        `Unsupported NODE_ENV="${rawNodeEnv}". Must be one of: production, development, or test.`
      );
    }
  }

  // 1. DATABASE_URL Validation
  const dbUrl = process.env.DATABASE_URL?.trim();
  const hasDbUrl = Boolean(
    dbUrl &&
    (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"))
  );

  if (!hasDbUrl) {
    if (strict) {
      errors.push(
        "DATABASE_URL is required in production and must start with postgresql:// or postgres:// (PostgreSQL/Neon)."
      );
    } else {
      warnings.push(
        "DATABASE_URL is not set or invalid. Local in-memory store will be used for development/testing only."
      );
    }
  }

  // 2. AUTH_SECRET Validation
  const authSecret = process.env.AUTH_SECRET?.trim();
  const secretValidation = validateAuthSecret(authSecret);

  if (!secretValidation.isValid) {
    if (strict) {
      errors.push(secretValidation.error || "Invalid AUTH_SECRET configuration.");
    } else {
      warnings.push(
        `AUTH_SECRET warning: ${secretValidation.error || "Invalid secret."} Development fallback may be insecure.`
      );
    }
  }

  // 3. Optional AI Provider Configuration
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY)?.trim();
  const hasGeminiKey = Boolean(geminiKey && geminiKey.length > 0);
  if (!hasGeminiKey) {
    warnings.push(
      "GEMINI_API_KEY is not configured. AI Tutor will operate in local pedagogical Socratic rule-based mode."
    );
  }

  // 4. Optional YouTube API Configuration
  const ytKey = process.env.YOUTUBE_API_KEY?.trim();
  const hasYtKey = Boolean(ytKey && ytKey.length > 0);
  if (!hasYtKey) {
    warnings.push(
      "YOUTUBE_API_KEY is not configured. Video search will operate using the vetted Mathisipan MATATAG curriculum directory."
    );
  }

  const isValid = errors.length === 0;

  if (strict && !isValid) {
    const errorList = errors.map((e, idx) => `  ${idx + 1}. ${e}`).join("\n");
    throw new Error(
      `[FATAL] Production Environment Validation Failed:\n${errorList}\nApplication startup halted to prevent insecure deployment.`
    );
  }

  return {
    isValid,
    isProduction: isProd,
    errors,
    warnings,
    status: {
      databaseConfigured: hasDbUrl,
      authSecretConfigured: secretValidation.isValid,
      geminiConfigured: hasGeminiKey,
      youtubeConfigured: hasYtKey,
      nodeEnv,
    },
  };
}

/**
 * Returns a sanitized summary of current environment health.
 * GUARANTEE: Never includes actual secret keys, database URLs, or credentials.
 */
export function getSanitizedEnvStatus() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const dbUrl = process.env.DATABASE_URL?.trim();
  const authSecret = process.env.AUTH_SECRET?.trim();
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY)?.trim();
  const ytKey = process.env.YOUTUBE_API_KEY?.trim();

  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    database: {
      configured: Boolean(dbUrl && (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"))),
      engine: "PostgreSQL / Neon",
    },
    auth: {
      secretConfigured: Boolean(authSecret && authSecret.length >= 32),
      algorithm: "HMAC-SHA256",
      cookieHttpOnly: true,
      cookieSecure: nodeEnv === "production",
    },
    aiTutor: {
      configured: Boolean(geminiKey && geminiKey.length > 0),
      mode: geminiKey ? "Gemini 3.8 Flash" : "Local Pedagogical Socratic Engine",
      gracefulFallback: true,
    },
    mathisipanVideo: {
      configured: Boolean(ytKey && ytKey.length > 0),
      mode: ytKey ? "YouTube Data API v3 + Curated Catalog" : "Curated Mathisipan Catalog",
      gracefulFallback: true,
    },
  };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
