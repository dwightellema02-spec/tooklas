/**
 * Sets the role of an existing account. Use it once to create the first administrator on a new
 * deployment: register normally on the site, then promote that account.
 *
 *   npx tsx scripts/promote-user.ts --email you@example.com --role ADMIN            # dry run
 *   npx tsx scripts/promote-user.ts --email you@example.com --role ADMIN --apply    # writes
 *
 * After that, administrators can promote teachers from the Admin page.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i > -1 ? args[i + 1] : undefined;
};

async function main() {
  const email = value("--email")?.trim().toLowerCase();
  const role = value("--role")?.toUpperCase();
  const apply = args.includes("--apply");

  if (!email || !role || !["STUDENT", "TEACHER", "ADMIN"].includes(role)) {
    throw new Error("Usage: --email <address> --role STUDENT|TEACHER|ADMIN [--apply]");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account found for ${email}. Register on the site first.`);

  console.log(`${user.name} <${user.email}>: ${user.role} -> ${role}`);
  if (!apply) {
    console.log("Dry run. Re-run with --apply to write the change.");
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: role as "STUDENT" | "TEACHER" | "ADMIN" } });
  console.log("Done. The person must sign out and sign in again for the new role to take effect.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
