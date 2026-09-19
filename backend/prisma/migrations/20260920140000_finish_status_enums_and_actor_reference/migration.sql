-- TT-090 (remaining columns) and TT-092 (actor reference on the audit log).
--
-- As with the previous enum migration, Prisma's own diff emits DROP COLUMN + ADD COLUMN
-- for the three conversions, which would discard every existing value. Each is converted
-- in place with a USING cast instead. Verified against a populated database.

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('assigned', 'self-enrolled', 'auto-assigned');
CREATE TYPE "RecordingType" AS ENUM ('file', 'link');
CREATE TYPE "TranscriptSource" AS ENUM ('pasted', 'uploaded_file');

-- project_members.enrollmentType (default is a text literal; drop and restore around it)
ALTER TABLE "project_members" ALTER COLUMN "enrollmentType" DROP DEFAULT;
ALTER TABLE "project_members" ALTER COLUMN "enrollmentType" TYPE "EnrollmentType" USING "enrollmentType"::"EnrollmentType";
ALTER TABLE "project_members" ALTER COLUMN "enrollmentType" SET DEFAULT 'assigned';

-- meeting_records.recordingType and .transcriptSource (both nullable, no default)
ALTER TABLE "meeting_records" ALTER COLUMN "recordingType" TYPE "RecordingType" USING "recordingType"::"RecordingType";
ALTER TABLE "meeting_records" ALTER COLUMN "transcriptSource" TYPE "TranscriptSource" USING "transcriptSource"::"TranscriptSource";

-- TT-092: an actor reference alongside the recorded name.
ALTER TABLE "activity_logs" ADD COLUMN "performedById" TEXT;
CREATE INDEX "activity_logs_performedById_idx" ON "activity_logs"("performedById");
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: link historic entries to their user, but only where the name identifies
-- exactly one. A name shared by two accounts is left null rather than guessed at — the
-- recorded name is still there, and a wrong attribution in an audit trail is worse than
-- an absent one.
UPDATE "activity_logs" a
SET "performedById" = u.id
FROM "users" u
WHERE u.name = a."performedBy"
  AND (SELECT COUNT(*) FROM "users" u2 WHERE u2.name = a."performedBy") = 1;
