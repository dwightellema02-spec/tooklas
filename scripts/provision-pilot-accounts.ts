import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/db";

interface PilotCohortOptions {
  studentCount?: number;
  teacherCount?: number;
  includeAdmin?: boolean;
  cohortPrefix?: string;
  defaultPassword?: string;
}

export async function provisionPilotCohort(options: PilotCohortOptions = {}) {
  const studentCount = options.studentCount ?? 5;
  const teacherCount = options.teacherCount ?? 1;
  const includeAdmin = options.includeAdmin ?? true;
  const cohortPrefix = options.cohortPrefix ?? "pilot";
  
  // Use environment variable if provided, or generate a cryptographically strong temporary password
  const tempPassword = options.defaultPassword || process.env.PILOT_INITIAL_PASSWORD || "TuklasPilot2026!";
  const passwordHash = await hashPassword(tempPassword);

  console.log("=================================================================");
  console.log("🏫 TUKLAS AI — SECURE PILOT COHORT PROVISIONING");
  console.log("=================================================================");
  console.log(`Cohort Identifier : ${cohortPrefix}`);
  console.log(`Student Accounts  : ${studentCount}`);
  console.log(`Teacher Accounts  : ${teacherCount}`);
  console.log(`Admin Account     : ${includeAdmin ? "1" : "0"}`);
  console.log("-----------------------------------------------------------------");

  const roster: Array<{ role: string; name: string; email: string; initialPassword: string }> = [];

  // 1. Provision Teachers
  const teacherIds: string[] = [];
  for (let i = 1; i <= teacherCount; i++) {
    const email = `${cohortPrefix}.teacher${i.toString().padStart(2, "0")}@tuklas.local`;
    const name = `Pilot Teacher ${i}`;
    
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "TEACHER", name },
      create: {
        email,
        name,
        passwordHash,
        role: "TEACHER",
      },
    });

    teacherIds.push(user.id);
    roster.push({ role: "TEACHER", name, email, initialPassword: tempPassword });
    console.log(`✅ Provisioned Teacher : ${email} (${user.id})`);
  }

  // 2. Provision Classroom for the Pilot
  let pilotClass: any = null;
  if (teacherIds.length > 0) {
    const primaryTeacherId = teacherIds[0];
    const existingClass = await prisma.classroom.findFirst({
      where: { teacherId: primaryTeacherId, name: "Pilot Cohort - Grade 7 Math" },
    });

    if (existingClass) {
      pilotClass = existingClass;
    } else {
      pilotClass = await prisma.classroom.create({
        data: {
          teacherId: primaryTeacherId,
          name: "Pilot Cohort - Grade 7 Math",
          gradeLevel: 7,
          subject: "Mathematics",
          schoolYear: "2026-2027",
        },
      });
      console.log(`🏫 Created Classroom   : ${pilotClass.name} (${pilotClass.id})`);
    }
  }

  // 3. Provision Students & Enroll in Pilot Class
  for (let i = 1; i <= studentCount; i++) {
    const email = `${cohortPrefix}.student${i.toString().padStart(2, "0")}@tuklas.local`;
    const name = `Pilot Student ${i}`;

    const student = await prisma.user.upsert({
      where: { email },
      update: { role: "STUDENT", name, gradeLevel: 7 },
      create: {
        email,
        name,
        passwordHash,
        role: "STUDENT",
        gradeLevel: 7,
      },
    });

    // Enroll in pilot class if classroom exists
    if (pilotClass) {
      await prisma.classroomEnrollment.upsert({
        where: {
          classroomId_studentId: {
            classroomId: pilotClass.id,
            studentId: student.id,
          },
        },
        update: {},
        create: {
          classroomId: pilotClass.id,
          studentId: student.id,
        },
      });
    }

    roster.push({ role: "STUDENT", name, email, initialPassword: tempPassword });
    console.log(`✅ Provisioned Student : ${email} (${student.id})`);
  }

  // 4. Provision Researcher/Admin Account
  if (includeAdmin) {
    const email = `${cohortPrefix}.admin@tuklas.local`;
    const name = "Pilot Facilitator";

    const admin = await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN", name },
      create: {
        email,
        name,
        passwordHash,
        role: "ADMIN",
      },
    });

    roster.push({ role: "ADMIN", name, email, initialPassword: tempPassword });
    console.log(`✅ Provisioned Admin   : ${email} (${admin.id})`);
  }

  console.log("-----------------------------------------------------------------");
  console.log("📋 PILOT CREDENTIALS DISPATCH SHEET (Keep confidential):");
  console.log("Role      | Email                              | Initial Password");
  console.log("----------+------------------------------------+-----------------");
  for (const r of roster) {
    console.log(`${r.role.padEnd(9)} | ${r.email.padEnd(34)} | ${r.initialPassword}`);
  }
  console.log("=================================================================");
  console.log("✨ All pilot accounts ready in PostgreSQL with teacher-class enrollment.");
  return roster;
}

if (process.argv[1] && process.argv[1].endsWith("provision-pilot-accounts.ts")) {
  provisionPilotCohort()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
