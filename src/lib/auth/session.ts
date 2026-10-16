/**
 * Session & Token Management Utility
 * Cryptographically signed session tokens for secure HTTP-only cookie and bearer auth.
 */

import "dotenv/config";
import crypto from "crypto";
import { UserRole } from "@prisma/client";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

export const KNOWN_COMPROMISED_SECRETS = new Set([
  "tuklas_ai_phase2_dev_secret_key_minimum_32_bytes",
  "placeholder_secret_min_32_characters_long",
  "changeme_secret_must_be_at_least_32_chars_long",
  "12345678901234567890123456789012",
]);

const VALID_ROLES = new Set<string>(Object.values(UserRole));

export class InsecureAuthSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsecureAuthSecretError";
  }
}

export function validateAuthSecret(secret: string | undefined): { isValid: boolean; error?: string } {
  if (!secret || typeof secret !== "string") {
    return { isValid: false, error: "AUTH_SECRET is required but is missing or not a string." };
  }
  const trimmed = secret.trim();
  if (trimmed.length < 32) {
    return {
      isValid: false,
      error: `AUTH_SECRET must be at least 32 characters (AUTH_SECRET is required for HMAC-SHA256 integrity, got ${trimmed.length}).`,
    };
  }
  if (KNOWN_COMPROMISED_SECRETS.has(trimmed)) {
    return {
      isValid: false,
      error: "AUTH_SECRET matches a known public repository default or placeholder. A unique secret is required.",
    };
  }
  return { isValid: true };
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  const validation = validateAuthSecret(secret);
  if (!validation.isValid) {
    throw new InsecureAuthSecretError(validation.error || "Invalid AUTH_SECRET configuration.");
  }
  return secret!.trim();
}

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function signData(dataString: string, secret?: string): string {
  const signingKey = secret ?? getAuthSecret();
  return crypto.createHmac("sha256", signingKey).update(dataString).digest("base64url");
}

export function createSessionToken(
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  },
  options?: { secret?: string; durationMs?: number }
): string {
  const now = Date.now();
  const duration = options?.durationMs ?? SESSION_DURATION_MS;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: now,
    expiresAt: now + duration,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signData(encodedPayload, options?.secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string, options?: { secret?: string }): SessionPayload | null {
  try {
    if (!token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    if (!encodedPayload || !signature) return null;

    const signingKey = options?.secret ?? getAuthSecret();
    const expectedSignature = signData(encodedPayload, signingKey);

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(encodedPayload, "base64url").toString("utf-8");
    const parsed = JSON.parse(jsonStr);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.userId !== "string" ||
      !parsed.userId.trim() ||
      typeof parsed.email !== "string" ||
      !parsed.email.trim() ||
      typeof parsed.name !== "string" ||
      typeof parsed.role !== "string" ||
      !VALID_ROLES.has(parsed.role) ||
      typeof parsed.createdAt !== "number" ||
      !Number.isFinite(parsed.createdAt) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }

    const payload: SessionPayload = {
      userId: parsed.userId,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role as UserRole,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

