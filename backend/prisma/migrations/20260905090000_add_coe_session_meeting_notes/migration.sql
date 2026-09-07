ALTER TABLE "coe_knowledge_sessions"
  ADD COLUMN IF NOT EXISTS "meetingNotesFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "meetingNotesFileUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "meetingNotesMimeType" TEXT;
