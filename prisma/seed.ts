/**
 * Tuklas AI - Initial Seed Data (Phase 2)
 * Seeds MATATAG Grade 7 Mathematics (Term 1) baseline sample and default test roles.
 */

import { PrismaClient, UserRole, LessonStatus, ProgressStatus, QuestionType, QuestionDifficulty, QuestionStatus, QuestionSource, PracticeSessionStatus, MistakeCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fallbackStore } from "../src/lib/db.ts";

const prisma = new PrismaClient();

export async function seedDatabase() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "Refusing to seed default demo accounts in production environment. Set ALLOW_PRODUCTION_SEED=true and DEMO_SEED_PASSWORD if initial seeding is explicitly intended."
    );
  }

  console.log("🌱 Starting Tuklas AI Phase 2 database seed...");

  // 1. Create Default Role Users (Passwords securely hashed with bcrypt)
  if (process.env.NODE_ENV === "production" && !process.env.DEMO_SEED_PASSWORD) {
    throw new Error("DEMO_SEED_PASSWORD must be set when seeding in production. The built-in development password is public.");
  }
  const rawSeedPassword = process.env.DEMO_SEED_PASSWORD || "Tuklas2026!";
  const defaultPassword = await bcrypt.hash(rawSeedPassword, 10);

  const studentUser = await prisma.user.upsert({
    where: { email: "student@tuklas.ai" },
    update: {
      name: "Juan de la Cruz",
      passwordHash: defaultPassword,
      role: UserRole.STUDENT,
      gradeLevel: 7,
    },
    create: {
      id: "usr_student_01",
      email: "student@tuklas.ai",
      name: "Juan de la Cruz",
      passwordHash: defaultPassword,
      role: UserRole.STUDENT,
      gradeLevel: 7,
    },
  });

  const studentUser2 = await prisma.user.upsert({
    where: { email: "maria.clara@tuklas.ai" },
    update: {
      name: "Maria Clara de los Santos",
      passwordHash: defaultPassword,
      role: UserRole.STUDENT,
      gradeLevel: 7,
    },
    create: {
      id: "usr_student_02",
      email: "maria.clara@tuklas.ai",
      name: "Maria Clara de los Santos",
      passwordHash: defaultPassword,
      role: UserRole.STUDENT,
      gradeLevel: 7,
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@tuklas.ai" },
    update: {
      name: "Maria Santos (Teacher)",
      passwordHash: defaultPassword,
      role: UserRole.TEACHER,
    },
    create: {
      id: "usr_teacher_01",
      email: "teacher@tuklas.ai",
      name: "Maria Santos (Teacher)",
      passwordHash: defaultPassword,
      role: UserRole.TEACHER,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@tuklas.ai" },
    update: {
      name: "Tuklas Administrator",
      passwordHash: defaultPassword,
      role: UserRole.ADMIN,
    },
    create: {
      id: "usr_admin_01",
      email: "admin@tuklas.ai",
      name: "Tuklas Administrator",
      passwordHash: defaultPassword,
      role: UserRole.ADMIN,
    },
  });

  console.log(`✅ Users seeded: Student (${studentUser.email}), Student 2 (${studentUser2.email}), Teacher (${teacherUser.email}), Admin (${adminUser.email})`);

  // 2. Create Subject: Mathematics
  const subject = await prisma.subject.upsert({
    where: { code: "MATH" },
    update: {},
    create: {
      code: "MATH",
      name: "Mathematics",
      description: "Department of Education MATATAG Mathematics Curriculum",
    },
  });

  // 3. Create Grade: Grade 7
  const grade = await prisma.grade.upsert({
    where: {
      subjectId_level: {
        subjectId: subject.id,
        level: 7,
      },
    },
    update: {},
    create: {
      subjectId: subject.id,
      level: 7,
      name: "Grade 7",
    },
  });

  // 4. Create Term: Term 1
  const term = await prisma.term.upsert({
    where: {
      gradeId_termNumber: {
        gradeId: grade.id,
        termNumber: 1,
      },
    },
    update: {},
    create: {
      gradeId: grade.id,
      termNumber: 1,
      name: "Term 1",
    },
  });

  // 5. Create Unit: Numbers and Algebraic Expressions
  const unit = await prisma.unit.upsert({
    where: { id: "unt_01" },
    update: {},
    create: {
      id: "unt_01",
      termId: term.id,
      sequenceOrder: 1,
      title: "Numbers and Algebraic Expressions",
      description: "Foundational number concepts, integers, and operations for Grade 7 MATATAG.",
    },
  });

  // 6. Create Competencies
  for (const cmp of fallbackStore.curriculum.competencies) {
    await prisma.competency.upsert({
      where: { id: cmp.id },
      update: {
        code: cmp.code,
        statement: cmp.statement,
        sequenceOrder: cmp.sequenceOrder,
      },
      create: {
        id: cmp.id,
        unitId: unit.id,
        code: cmp.code,
        statement: cmp.statement,
        sequenceOrder: cmp.sequenceOrder,
      },
    });
  }

  // 7. Create Skills
  for (const skl of fallbackStore.curriculum.skills) {
    await prisma.skill.upsert({
      where: { id: skl.id },
      update: {
        competencyId: skl.competencyId,
        title: skl.title,
        description: skl.description,
        sequenceOrder: skl.sequenceOrder,
        difficulty: skl.difficulty,
      },
      create: {
        id: skl.id,
        competencyId: skl.competencyId,
        title: skl.title,
        description: skl.description,
        sequenceOrder: skl.sequenceOrder,
        difficulty: skl.difficulty,
      },
    });
  }

  // 8. Skill Prerequisites
  await prisma.skillPrerequisite.upsert({
    where: { skillId_prerequisiteSkillId: { skillId: "skl_02", prerequisiteSkillId: "skl_01" } },
    update: {},
    create: { skillId: "skl_02", prerequisiteSkillId: "skl_01" },
  });

  await prisma.skillPrerequisite.upsert({
    where: { skillId_prerequisiteSkillId: { skillId: "skl_03", prerequisiteSkillId: "skl_02" } },
    update: {},
    create: { skillId: "skl_03", prerequisiteSkillId: "skl_02" },
  });

  await prisma.skillPrerequisite.upsert({
    where: { skillId_prerequisiteSkillId: { skillId: "skl_06", prerequisiteSkillId: "skl_04" } },
    update: {},
    create: { skillId: "skl_06", prerequisiteSkillId: "skl_04" },
  });

  // 9. Create Lessons
  let primaryLesson = null;
  for (const lsn of fallbackStore.curriculum.lessons) {
    const createdLesson = await prisma.lesson.upsert({
      where: { id: lsn.id },
      update: {
        unitId: unit.id,
        authorId: teacherUser.id,
        title: lsn.title,
        description: lsn.description,
        videoUrl: (lsn as any).videoUrl || null,
      },
      create: {
        id: lsn.id,
        unitId: unit.id,
        authorId: teacherUser.id,
        sequenceOrder: lsn.sequenceOrder,
        title: lsn.title,
        description: lsn.description,
        learningObjectives: lsn.learningObjectives,
        status: lsn.status as LessonStatus,
        estimatedMinutes: lsn.estimatedMinutes,
        videoUrl: (lsn as any).videoUrl || null,
      },
    });
    if (lsn.id === "lsn_01") primaryLesson = createdLesson;

    if (lsn.skillIds) {
      for (const sId of lsn.skillIds) {
        await prisma.lessonSkill.upsert({
          where: { lessonId_skillId: { lessonId: lsn.id, skillId: sId } },
          update: {},
          create: { lessonId: lsn.id, skillId: sId },
        });
      }
    }

    if (lsn.contentBlocks) {
      for (const blk of lsn.contentBlocks) {
        await prisma.lessonContentBlock.upsert({
          where: { id: blk.id },
          update: {
            lessonId: lsn.id,
            type: blk.type as any,
            sequenceOrder: blk.sequenceOrder,
            title: blk.title,
            content: blk.content,
            metadata: blk.metadata,
          },
          create: {
            id: blk.id,
            lessonId: lsn.id,
            type: blk.type as any,
            sequenceOrder: blk.sequenceOrder,
            title: blk.title,
            content: blk.content,
            metadata: blk.metadata,
          },
        });
      }
    }

    if (lsn.resources) {
      for (const res of lsn.resources) {
        await prisma.lessonResource.upsert({
          where: { id: res.id },
          update: {
            lessonId: lsn.id,
            type: res.type as any,
            title: res.title,
            url: res.url,
            youtubeId: res.youtubeId,
            provider: (res as any).provider || "YOUTUBE",
            channelName: (res as any).channelName,
            thumbnailUrl: (res as any).thumbnailUrl,
            description: (res as any).description,
            duration: (res as any).duration,
            status: (res as any).status as any,
            notes: (res as any).notes,
            sequenceOrder: res.sequenceOrder,
          },
          create: {
            id: res.id,
            lessonId: lsn.id,
            type: res.type as any,
            title: res.title,
            url: res.url,
            youtubeId: res.youtubeId,
            provider: (res as any).provider || "YOUTUBE",
            channelName: (res as any).channelName,
            thumbnailUrl: (res as any).thumbnailUrl,
            description: (res as any).description,
            duration: (res as any).duration,
            status: (res as any).status as any,
            addedBy: (res as any).addedBy || teacherUser.id,
            notes: (res as any).notes,
            sequenceOrder: res.sequenceOrder,
          },
        });
      }
    }
  }

  const lesson = primaryLesson!;

  // 10. Create Practice Sets
  for (const ps of fallbackStore.practiceSets) {
    await prisma.practiceSet.upsert({
      where: { id: ps.id },
      update: {
        title: ps.title,
        description: ps.description,
        lessonId: ps.lessonId,
        skillId: ps.skillId,
        questionCount: ps.questionCount,
      },
      create: {
        id: ps.id,
        title: ps.title,
        description: ps.description,
        lessonId: ps.lessonId,
        skillId: ps.skillId,
        status: ps.status as any,
        questionCount: ps.questionCount,
        createdById: teacherUser.id,
      },
    });
  }

  // 9. Seed Questions from fallbackStore
  for (const q of fallbackStore.questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        lessonId: q.lessonId,
        skillId: q.skillId,
        questionData: q.questionData,
      },
      create: {
        id: q.id,
        lessonId: q.lessonId,
        skillId: q.skillId,
        type: q.type as QuestionType,
        prompt: q.prompt,
        explanation: q.explanation,
        difficulty: q.difficulty as QuestionDifficulty,
        status: q.status as QuestionStatus,
        source: q.source as QuestionSource,
        createdById: teacherUser.id,
        reviewedById: adminUser.id,
        questionData: q.questionData,
        correctFeedback: q.correctFeedback,
        incorrectFeedback: q.incorrectFeedback,
        allowRetry: q.allowRetry,
        maxAttempts: q.maxAttempts,
      },
    });
  }

  // 10. Seed Practice Set Questions
  for (const psq of fallbackStore.practiceSetQuestions) {
    await prisma.practiceSetQuestion.upsert({
      where: { id: psq.id },
      update: {
        practiceSetId: psq.practiceSetId,
        questionId: psq.questionId,
        order: psq.order,
      },
      create: {
        id: psq.id,
        practiceSetId: psq.practiceSetId,
        questionId: psq.questionId,
        order: psq.order,
      },
    });
  }

  // 11. Seed Practice Session
  const practiceSession = await prisma.practiceSession.upsert({
    where: { id: "pses_01" },
    update: {},
    create: {
      id: "pses_01",
      studentId: studentUser.id,
      lessonId: lesson.id,
      skillId: "skl_01",
      status: PracticeSessionStatus.COMPLETED,
      score: 87.5,
      totalQuestions: 8,
      correctAnswers: 7,
    },
  });

  // 11. Seed Question Attempts
  for (const att of fallbackStore.questionAttempts) {
    await prisma.questionAttempt.upsert({
      where: { id: att.id },
      update: {},
      create: {
        id: att.id,
        studentId: att.studentId,
        questionId: att.questionId,
        practiceSessionId: att.practiceSessionId,
        skillId: att.skillId,
        answer: att.answer,
        isCorrect: att.isCorrect,
        attemptNumber: att.attemptNumber,
        timeTakenMs: att.timeTakenMs,
        hintUsed: att.hintUsed,
        submittedAt: att.submittedAt,
      },
    });
  }

  // 12. Create Student Progress Record
  await prisma.studentProgress.upsert({
    where: {
      userId_skillId: {
        userId: studentUser.id,
        skillId: "skl_01",
      },
    },
    update: {},
    create: {
      userId: studentUser.id,
      lessonId: lesson.id,
      skillId: "skl_01",
      status: ProgressStatus.DEVELOPING,
      progressPercentage: 65.0,
      understandingScore: 0.70,
      accuracyScore: 0.60,
      applicationScore: 0.65,
      consistencyScore: 0.55,
      compositeScore: 0.63,
      attemptCount: 3,
    },
  });

  // 13. Create Classrooms & Enrollments
  await prisma.classroom.upsert({
    where: { id: "cls_01" },
    update: { teacherId: teacherUser.id },
    create: {
      id: "cls_01",
      name: "Grade 7 - Section Rizal",
      gradeLevel: 7,
      subject: "Mathematics",
      schoolYear: "2026-2027",
      teacherId: teacherUser.id,
    },
  });

  await prisma.classroom.upsert({
    where: { id: "cls_02" },
    update: { teacherId: teacherUser.id },
    create: {
      id: "cls_02",
      name: "Grade 7 - Section Bonifacio",
      gradeLevel: 7,
      subject: "Mathematics",
      schoolYear: "2026-2027",
      teacherId: teacherUser.id,
    },
  });

  await prisma.classroomEnrollment.upsert({
    where: { classroomId_studentId: { classroomId: "cls_01", studentId: studentUser.id } },
    update: {},
    create: { classroomId: "cls_01", studentId: studentUser.id },
  });

  await prisma.classroomEnrollment.upsert({
    where: { classroomId_studentId: { classroomId: "cls_01", studentId: studentUser2.id } },
    update: {},
    create: { classroomId: "cls_01", studentId: studentUser2.id },
  });

  await prisma.classroomEnrollment.upsert({
    where: { classroomId_studentId: { classroomId: "cls_02", studentId: studentUser.id } },
    update: {},
    create: { classroomId: "cls_02", studentId: studentUser.id },
  });

  // 14. Create Skill Mastery Record for Student 1
  await prisma.skillMastery.upsert({
    where: { studentId_skillId: { studentId: studentUser.id, skillId: "skl_01" } },
    update: {},
    create: {
      studentId: studentUser.id,
      skillId: "skl_01",
      status: "PROFICIENT",
      evidenceSummary: "10 attempts with 90% accuracy across multiple choice and true/false questions.",
      accuracy: 0.9,
      recentAccuracy: 1.0,
      consistencyScore: 0.85,
      applicationScore: 0.8,
      attemptCount: 10,
      masteryVersion: "MASTERY_V1",
      metadata: JSON.stringify({ ruleCode: "RULE_PROFICIENT" }),
    },
  });

  // 15. Create Mistake Analysis Record
  await prisma.mistakeAnalysis.upsert({
    where: { id: "mana_seed_01" },
    update: {
      lessonId: lesson.id,
      skillId: "skl_02",
    },
    create: {
      id: "mana_seed_01",
      studentId: studentUser.id,
      skillId: "skl_02",
      lessonId: lesson.id,
      practiceSessionId: practiceSession.id,
      category: MistakeCategory.CONCEPTUAL_MISUNDERSTANDING,
      observation: "Student answered questions comparing negative integers with lower accuracy.",
      pattern: "Selected the negative number with larger absolute value as the greater number.",
      possibleCause: "Applying whole number magnitude rules to negative integers without number-line orientation.",
      confidence: 0.84,
      recommendation: "Practice placing pairs of integers on a number line.",
      evidenceSummary: "Identified in practice session across 2 incorrect attempts.",
      status: "COMPLETED",
      trigger: "PRACTICE_COMPLETED",
      analyzerVersion: "1.0",
      metadata: JSON.stringify({ accuracy: 50 }),
    },
  });

  // Link evidence attempt att_05 to mistakeAnalysis
  await prisma.mistakeAnalysisEvidence.upsert({
    where: { analysisId_attemptId: { analysisId: "mana_seed_01", attemptId: "att_05" } },
    update: {},
    create: {
      analysisId: "mana_seed_01",
      attemptId: "att_05",
      relevanceScore: 1.0,
      notes: "Direct evidence on comparing negative integers",
    },
  });

  console.log("✅ Curriculum hierarchy, sample skills, classrooms, and mastery records seeded successfully!");
}

if (process.env.NODE_ENV !== "test") {
  seedDatabase()
    .catch((e) => {
      console.error("❌ Seed execution error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
