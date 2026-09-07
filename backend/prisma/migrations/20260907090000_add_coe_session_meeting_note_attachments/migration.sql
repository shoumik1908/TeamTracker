CREATE TABLE "coe_session_meeting_notes" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coe_session_meeting_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coe_session_meeting_notes_sessionId_createdAt_idx"
  ON "coe_session_meeting_notes"("sessionId", "createdAt");

ALTER TABLE "coe_session_meeting_notes"
  ADD CONSTRAINT "coe_session_meeting_notes_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "coe_knowledge_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coe_session_meeting_notes"
  ADD CONSTRAINT "coe_session_meeting_notes_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
