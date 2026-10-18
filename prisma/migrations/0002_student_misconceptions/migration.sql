-- CreateEnum
CREATE TYPE "MisconceptionStatus" AS ENUM ('SUSPECTED', 'CHECKING', 'SUPPORTED', 'NOT_SUPPORTED', 'CORRECTING', 'RESOLVED', 'PERSISTING', 'DISMISSED');

-- CreateTable
CREATE TABLE "StudentMisconception" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "lessonId" TEXT,
    "conceptKey" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "belief" TEXT NOT NULL,
    "status" "MisconceptionStatus" NOT NULL DEFAULT 'SUSPECTED',
    "confidence" DOUBLE PRECISION NOT NULL,
    "observation" TEXT NOT NULL,
    "observedAnswers" TEXT NOT NULL,
    "evidenceAttemptIds" TEXT NOT NULL,
    "alternatives" TEXT NOT NULL,
    "diagnosticQuestionId" TEXT,
    "verificationQuestionId" TEXT,
    "correction" TEXT NOT NULL,
    "checks" TEXT NOT NULL,
    "teacherNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StudentMisconception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentMisconception_studentId_skillId_status_idx" ON "StudentMisconception"("studentId", "skillId", "status");

-- CreateIndex
CREATE INDEX "StudentMisconception_status_idx" ON "StudentMisconception"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMisconception_studentId_skillId_conceptKey_key" ON "StudentMisconception"("studentId", "skillId", "conceptKey");

-- AddForeignKey
ALTER TABLE "StudentMisconception" ADD CONSTRAINT "StudentMisconception_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMisconception" ADD CONSTRAINT "StudentMisconception_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

