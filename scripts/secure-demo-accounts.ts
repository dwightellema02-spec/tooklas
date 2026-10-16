/**
 * Secures the demo accounts created by prisma/seed.ts. Their default password is public, so any
 * database that was ever seeded must run this before it is used by real people.
 *
 *   npx tsx scripts/secure-demo-accounts.ts            # dry run: lists the accounts that would change
 *   npx tsx scripts/secure-demo-accounts.ts --apply    # writes the changes
 *
 * Every demo account gets a fresh random password that is not shown anywhere, which locks it.
 * To keep one account usable, set NEW_ADMIN_PASSWORD and/or NEW_TEACHER_PASSWORD (at least 12
 * characters) in the environment; admin@tuklas.ai and teacher@tuklas.ai then get those instead.
 */

import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const DEMO_EMAILS = [
  "student@tuklas.ai",
  "maria.clara@tuklas.ai",
  "crisostomo.ibarra@tuklas.ai",
  "basilio.magalang@tuklas.ai",
  "elias.salvi@tuklas.ai",
  "teacher@tuklas.ai",
  "admin@tuklas.ai",
];

const chosenPasswords: Record<string, string | undefined> = {
  "admin@tuklas.ai": process.env.NEW_ADMIN_PASSWORD,
  "teacher@tuklas.ai": process.env.NEW_TEACHER_PASSWORD,
};

async function main() {
  for (const [email, pw] of Object.entries(chosenPasswords)) {
    if (pw !== undefined && pw.length < 12) {
      throw new Error(`The new password for ${email} must be at least 12 characters.`);
    }
  }

  const users = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } } });
  if (users.length === 0) {
    console.log("No demo accounts found. Nothing to do.");
    return;
  }

  for (const user of users) {
    const chosen = chosenPasswords[user.email];
    const password = chosen ?? crypto.randomBytes(24).toString("base64url");
    console.log(`${apply ? "secured" : "would secure"}: ${user.email} (${user.role}) -> ${chosen ? "password from environment" : "locked with a random password"}`);
    if (apply) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    }
  }
  console.log(apply ? "\nDone." : "\nDry run complete. Re-run with --apply to write the changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
