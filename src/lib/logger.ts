/**
 * Tuklas AI - Production Safe Logger & Sanitizer
 * Phase 14: Production Readiness, Reliability & Deployment Hardening
 *
 * Provides sanitized logging methods ensuring sensitive credentials,
 * tokens, passwords, cookies, or secrets are NEVER leaked into stdout/stderr.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "pass",
  "token",
  "authsecret",
  "auth_secret",
  "secret",
  "apikey",
  "api_key",
  "gemini_api_key",
  "youtube_api_key",
  "authorization",
  "cookie",
  "tuklas_session",
  "database_url",
  "databaseurl",
]);

/**
 * Redacts database connection strings containing credentials
 * e.g. postgresql://user:pass@host:port/db -> postgresql://[REDACTED]@host:port/db
 */
export function redactDatabaseUrl(str: string): string {
  if (typeof str !== "string") return str;
  return str.replace(
    /(postgres(?:ql)?:\/\/)([^:@\s]+):([^@\s]+)@/gi,
    "$1[REDACTED]:[REDACTED]@"
  );
}

/**
 * Recursively redacts sensitive keys from an object or string before logging.
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 5) return "[DEPTH_LIMIT]";
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    let sanitized = redactDatabaseUrl(data);
    if (sanitized.length > 1000) {
      sanitized = sanitized.slice(0, 1000) + "... [TRUNCATED]";
    }
    return sanitized;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: redactDatabaseUrl(data.message),
      code: (data as any).code,
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === "object") {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = sanitizeLogData(val, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return "[UNSERIALIZABLE]";
}

export const safeLog = {
  info: (...args: any[]) => {
    console.log(...args.map((a) => (typeof a === "object" ? sanitizeLogData(a) : redactDatabaseUrl(String(a)))));
  },
  warn: (...args: any[]) => {
    console.warn(...args.map((a) => (typeof a === "object" ? sanitizeLogData(a) : redactDatabaseUrl(String(a)))));
  },
  error: (...args: any[]) => {
    console.error(...args.map((a) => (typeof a === "object" ? sanitizeLogData(a) : redactDatabaseUrl(String(a)))));
  },
};
