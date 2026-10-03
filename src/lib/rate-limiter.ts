/**
 * Tuklas AI - In-Memory Sliding-Window Rate Limiter
 * Phase 14: Production Readiness, Reliability & Deployment Hardening
 *
 * Lightweight, zero-dependency in-memory sliding window rate limiter
 * to protect sensitive endpoints (login, registration, password attempts)
 * from brute-force attacks and abuse.
 */

import { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs: number; // Duration of time window in ms
  max: number; // Maximum allowed requests per windowMs
  message: string; // Error message returned on 429
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface WindowRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, WindowRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      max: options.max,
      message: options.message,
      keyGenerator:
        options.keyGenerator ||
        ((req: Request) => {
          const forwarded = req.headers["x-forwarded-for"];
          const ip =
            typeof forwarded === "string"
              ? forwarded.split(",")[0].trim()
              : req.ip || req.socket.remoteAddress || "127.0.0.1";
          return `${ip}:${req.path}`;
        }),
      skip: options.skip || (() => false),
    };

    // Periodically clean up stale entries every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanup() {
    const cutoff = Date.now() - this.options.windowMs;
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > cutoff);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }

  public reset() {
    this.records.clear();
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.options.skip(req)) {
        return next();
      }

      const key = this.options.keyGenerator(req);
      const now = Date.now();
      const cutoff = now - this.options.windowMs;

      let record = this.records.get(key);
      if (!record) {
        record = { timestamps: [] };
        this.records.set(key, record);
      }

      // Filter out timestamps outside current sliding window
      record.timestamps = record.timestamps.filter((t) => t > cutoff);

      const count = record.timestamps.length;
      const resetSeconds = Math.ceil(this.options.windowMs / 1000);

      if (count >= this.options.max) {
        res.setHeader("X-RateLimit-Limit", this.options.max.toString());
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setHeader("Retry-After", resetSeconds.toString());
        return res.status(429).json({
          success: false,
          error: this.options.message,
        });
      }

      record.timestamps.push(now);
      const remaining = Math.max(0, this.options.max - record.timestamps.length);
      res.setHeader("X-RateLimit-Limit", this.options.max.toString());
      res.setHeader("X-RateLimit-Remaining", remaining.toString());
      next();
    };
  }
}

// 1. Login Rate Limiter: max 15 attempts per 1 minute per IP
export const loginRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: "Too many login attempts. Please wait a minute before trying again.",
});

// 2. Registration Rate Limiter: max 10 registrations per 15 minutes per IP
export const registerRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts from this address. Please try again later.",
});

// 3. Sensitive Submission Limiter: max 60 attempts per minute per IP
export const submissionRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Request rate exceeded for submissions. Please slow down.",
});
