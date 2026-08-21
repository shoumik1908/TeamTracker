-- CreateEnum
CREATE TYPE "CoeSessionStatus" AS ENUM ('SCHEDULED', 'ENDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COE_SESSION_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COE_SESSION_REMINDER_DAY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COE_SESSION_REMINDER_30_MIN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COE_SESSION_ABSENCE_REPORTED';

-- CreateTable
CREATE TABLE "coe_knowledge_sessions" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "CoeSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "organizerId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "attendanceSummary" TEXT,
    "transcriptFileName" TEXT,
    "transcriptFileUrl" TEXT,
    "transcriptMimeType" TEXT,
    "transcriptText" TEXT,
    "transcriptSummary" TEXT,
    "dayReminderSentAt" TIMESTAMP(3),
    "thirtyMinuteReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_knowledge_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coe_session_attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_session_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coe_knowledge_sessions_status_scheduledAt_idx" ON "coe_knowledge_sessions"("status", "scheduledAt");
CREATE UNIQUE INDEX "coe_session_attendance_sessionId_memberId_key" ON "coe_session_attendance"("sessionId", "memberId");
CREATE INDEX "coe_session_attendance_memberId_idx" ON "coe_session_attendance"("memberId");

-- AddForeignKey
ALTER TABLE "coe_knowledge_sessions" ADD CONSTRAINT "coe_knowledge_sessions_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coe_session_attendance" ADD CONSTRAINT "coe_session_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "coe_knowledge_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coe_session_attendance" ADD CONSTRAINT "coe_session_attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
