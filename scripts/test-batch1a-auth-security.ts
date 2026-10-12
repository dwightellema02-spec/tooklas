import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import {
  createSessionToken,
  verifySessionToken,
  validateAuthSecret,
  getAuthSecret,
  KNOWN_COMPROMISED_SECRETS,
  InsecureAuthSecretError,
} from "../src/lib/auth/session.ts";
import { validateProductionEnv } from "../src/lib/env.ts";

describe("Batch 1A: Authentication Security Hardening", () => {
  const secureTestSecret = "test_secure_random_key_abc1234567890_min_32_chars";

  describe("Secret Validation & Enforcement", () => {
    it("should reject missing or empty secrets", () => {
      assert.equal(validateAuthSecret(undefined).isValid, false);
      assert.equal(validateAuthSecret("").isValid, false);
      assert.equal(validateAuthSecret("   ").isValid, false);
    });

    it("should reject secrets shorter than 32 characters", () => {
      const short = "short_secret_under_32_characters";
      const res = validateAuthSecret(short.slice(0, 20));
      assert.equal(res.isValid, false);
      assert.match(res.error || "", /at least 32 characters/);
    });

    it("should reject all known compromised or placeholder secrets", () => {
      for (const comp of KNOWN_COMPROMISED_SECRETS) {
        const res = validateAuthSecret(comp);
        assert.equal(res.isValid, false);
        assert.match(res.error || "", /known public repository default/);
      }
    });

    it("should accept valid unique 32+ character secrets", () => {
      const res = validateAuthSecret(secureTestSecret);
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it("should throw InsecureAuthSecretError when calling getAuthSecret with invalid secret in env", () => {
      const original = process.env.AUTH_SECRET;
      try {
        process.env.AUTH_SECRET = "too_short";
        assert.throws(() => getAuthSecret(), InsecureAuthSecretError);
      } finally {
        process.env.AUTH_SECRET = original;
      }
    });
  });

  describe("Session Token Verification & Tamper Resistance", () => {
    const validUser = {
      id: "usr_student_test",
      email: "student@test.local",
      name: "Test Student",
      role: UserRole.STUDENT,
    };

    it("should generate and verify a valid session token", () => {
      const token = createSessionToken(validUser, { secret: secureTestSecret });
      assert.ok(typeof token === "string");
      assert.ok(token.includes("."));

      const verified = verifySessionToken(token, { secret: secureTestSecret });
      assert.ok(verified !== null);
      assert.equal(verified?.userId, validUser.id);
      assert.equal(verified?.email, validUser.email);
      assert.equal(verified?.role, UserRole.STUDENT);
    });

    it("should reject token signed with a different secret", () => {
      const token = createSessionToken(validUser, { secret: secureTestSecret });
      const otherSecret = "another_completely_different_secure_secret_key_32c";
      const verified = verifySessionToken(token, { secret: otherSecret });
      assert.equal(verified, null);
    });

    it("should reject tampered payload", () => {
      const token = createSessionToken(validUser, { secret: secureTestSecret });
      const [payload, sig] = token.split(".");

      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
      decoded.role = "ADMIN"; // Privilege escalation attempt
      const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${sig}`;

      const verified = verifySessionToken(tamperedToken, { secret: secureTestSecret });
      assert.equal(verified, null);
    });

    it("should reject expired tokens", () => {
      const token = createSessionToken(validUser, { secret: secureTestSecret, durationMs: -1000 });
      const verified = verifySessionToken(token, { secret: secureTestSecret });
      assert.equal(verified, null);
    });

    it("should reject invalid/malformed token structures", () => {
      assert.equal(verifySessionToken("", { secret: secureTestSecret }), null);
      assert.equal(verifySessionToken("not-a-token", { secret: secureTestSecret }), null);
      assert.equal(verifySessionToken("a.b.c", { secret: secureTestSecret }), null);
      assert.equal(verifySessionToken("invalid-payload.sig", { secret: secureTestSecret }), null);
    });

    it("should reject tokens with invalid or unauthorized roles", () => {
      const badRolePayload = {
        userId: "usr_bad",
        email: "bad@test.local",
        name: "Bad",
        role: "SUPERUSER", // Not a valid UserRole
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const encoded = Buffer.from(JSON.stringify(badRolePayload)).toString("base64url");
      const sig = crypto.createHmac("sha256", secureTestSecret).update(encoded).digest("base64url");
      const token = `${encoded}.${sig}`;

      const verified = verifySessionToken(token, { secret: secureTestSecret });
      assert.equal(verified, null);
    });

    it("should strictly reject legacy development bypass signatures", () => {
      const legacySignatures = [
        "fnr-qoXqE9E7Vc9P92ba50r313-qvj_8L49oKjUY9Ss",
        "yAgq5cK9AH3pQXMdas9fqwVW8Wk1ljwojxEMd9BT1tY",
      ];

      for (const sig of legacySignatures) {
        const payload = Buffer.from(
          JSON.stringify({
            userId: "usr_attacker",
            email: "attacker@test.local",
            name: "Attacker",
            role: "ADMIN",
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          })
        ).toString("base64url");

        const forgedToken = `${payload}.${sig}`;
        const verified = verifySessionToken(forgedToken, { secret: secureTestSecret });
        assert.equal(verified, null);
      }
    });
  });

  describe("Fail-Closed Environment Invariants", () => {
    const origEnv = { ...process.env };

    it("should fail closed if NODE_ENV is unset or unknown", () => {
      delete process.env.NODE_ENV;
      process.env.AUTH_SECRET = secureTestSecret;
      process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";

      assert.throws(() => validateProductionEnv({ strict: true }), /NODE_ENV is not set/);
    });

    it("should fail closed if AUTH_SECRET is invalid in strict mode", () => {
      process.env.NODE_ENV = "production";
      process.env.AUTH_SECRET = "too_short";
      process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";

      assert.throws(() => validateProductionEnv(), /AUTH_SECRET must be at least 32 characters/);
    });

    it("should fail closed if AUTH_SECRET is a known compromised default in strict mode", () => {
      process.env.NODE_ENV = "production";
      process.env.AUTH_SECRET = "tuklas_ai_phase2_dev_secret_key_minimum_32_bytes";
      process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";

      assert.throws(() => validateProductionEnv(), /known public repository default/);
    });

    it("should pass when environment and secrets satisfy all invariants", () => {
      process.env.NODE_ENV = "production";
      process.env.AUTH_SECRET = secureTestSecret;
      process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";

      const res = validateProductionEnv();
      assert.equal(res.isValid, true);
      assert.equal(res.errors.length, 0);
    });

    // Restore env after tests
    test.after(() => {
      process.env = origEnv;
    });
  });
});
