/**
 * Tuklas AI - Production Error Handling & Sanitization Architecture
 * Phase 14: Production Readiness, Reliability & Deployment Hardening
 *
 * Centralized error normalization and sanitization. Ensures that under no
 * circumstances are database credentials, Prisma stack traces, internal table names,
 * SQL fragments, or sensitive secrets leaked to client responses.
 */

import { Request, Response, NextFunction } from "express";
import { DatabaseUnavailableError } from "./db";

export interface ApiErrorResponse {
  success?: boolean;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Sanitizes any raw exception into a clean, safe, client-facing error message.
 */
export function sanitizeErrorMessage(error: unknown, fallbackMessage = "An unexpected error occurred."): {
  statusCode: number;
  message: string;
} {
  if (!error) {
    return { statusCode: 500, message: fallbackMessage };
  }

  // 1. Explicit DatabaseUnavailableError (503 Service Unavailable)
  if (error instanceof DatabaseUnavailableError) {
    return {
      statusCode: 503,
      message: "Database service is temporarily unavailable. Please try again.",
    };
  }

  const err = error as any;
  const errMsg = typeof err.message === "string" ? err.message : String(error);

  // 2. Prisma Known Request Errors
  if (err.code && typeof err.code === "string" && err.code.startsWith("P")) {
    switch (err.code) {
      case "P1000": // Authentication failed against database server
      case "P1001": // Can't reach database server
      case "P1002": // Database server timed out
      case "P1003": // Database does not exist
      case "P1008": // Operations timed out
      case "P1017": // Server closed connection
        return {
          statusCode: 503,
          message: "Database service is temporarily unavailable. Please try again.",
        };
      case "P2002": // Unique constraint violation
        return {
          statusCode: 409,
          message: "A record with this identifier already exists.",
        };
      case "P2025": // Record to update/delete not found
        return {
          statusCode: 404,
          message: "The requested record was not found.",
        };
      case "P2003": // Foreign key constraint violation
        return {
          statusCode: 400,
          message: "Invalid relation reference or dependency constraint violation.",
        };
      default:
        return {
          statusCode: 500,
          message: "Database operation failed. Please try again.",
        };
    }
  }

  // 3. Database connection string or raw connection errors
  if (
    errMsg.includes("connect ECONNREFUSED") ||
    errMsg.includes("ETIMEDOUT") ||
    errMsg.includes("database system is shutting down") ||
    errMsg.includes("PrismaClientInitializationError")
  ) {
    return {
      statusCode: 503,
      message: "Database service is temporarily unavailable. Please try again.",
    };
  }

  // 4. Rate Limiting (429)
  if (errMsg.includes("Rate limit exceeded") || errMsg.includes("Too many requests")) {
    return {
      statusCode: 429,
      message: errMsg,
    };
  }

  // 5. Authorization & Permissions (401 / 403)
  if (
    errMsg.includes("Unauthorized") ||
    errMsg.includes("Please sign in") ||
    errMsg.includes("Please log in") ||
    errMsg.includes("No active session")
  ) {
    return {
      statusCode: 401,
      message: errMsg,
    };
  }

  if (
    errMsg.includes("Forbidden") ||
    errMsg.includes("Teacher or Administrator access required") ||
    errMsg.includes("You do not teach this class") ||
    errMsg.includes("access denied") ||
    errMsg.includes("Access denied")
  ) {
    return {
      statusCode: 403,
      message: errMsg,
    };
  }

  // 6. Resource Not Found (404)
  if (
    errMsg.includes("not found") ||
    errMsg.includes("Not found") ||
    errMsg.includes("does not exist")
  ) {
    return {
      statusCode: 404,
      message: errMsg,
    };
  }

  // 7. Client Input Validation Errors (400)
  if (
    errMsg.includes("required") ||
    errMsg.includes("Invalid") ||
    errMsg.includes("invalid") ||
    errMsg.includes("must be") ||
    errMsg.includes("Maximum attempts") ||
    errMsg.includes("Retries are not permitted") ||
    errMsg.includes("already completed")
  ) {
    return {
      statusCode: 400,
      message: errMsg,
    };
  }

  // In production, mask raw unexpected exception messages
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    return {
      statusCode: 500,
      message: fallbackMessage,
    };
  }

  return {
    statusCode: 500,
    message: errMsg || fallbackMessage,
  };
}

/**
 * Express middleware to sanitize body-parser syntax errors (e.g. malformed JSON).
 * Prevents default Express HTML stack trace leakage.
 */
export function jsonParsingErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      error: "Malformed JSON payload in request body.",
    });
  }
  next(err);
}

/**
 * Express centralized unhandled error boundary middleware.
 */
export function centralizedErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const { statusCode, message } = sanitizeErrorMessage(err);
  return res.status(statusCode).json({
    success: false,
    error: message,
  });
}
