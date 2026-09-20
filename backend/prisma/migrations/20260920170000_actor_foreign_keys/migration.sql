-- TT-092 (remainder): give the file and link actor columns real foreign keys.
--
-- These held a team-member id as a bare string, so deleting a member left a dangling
-- reference that the UI silently rendered as nobody. Adding the constraint directly
-- fails: production has four project_files rows whose uploadedBy is the literal
-- 'system-proposal-generator', written by the proposal generator for files it uploads
-- itself. Those become NULL, which is now the representation for "the system did this" —
-- the listing already renders nothing for an id it cannot resolve, so this changes no
-- output, and the delete check (uploadedBy === caller) already excluded them.
--
-- The columns become nullable and SetNull, so removing a member neither deletes their
-- files nor blocks the deletion; the record survives without a false attribution.
--
-- project_notes.updatedBy gets the index but deliberately no foreign key: an
-- administrator with no team-member record writes their *user* id there, so it can hold
-- an id from either table and neither constraint would hold.

ALTER TABLE "project_files" ALTER COLUMN "uploadedBy" DROP NOT NULL;
ALTER TABLE "project_links" ALTER COLUMN "addedBy" DROP NOT NULL;
ALTER TABLE "project_notes" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- Clear values that do not name a team member, so the constraints below can be created.
UPDATE "project_files" f
SET "uploadedBy" = NULL
WHERE f."uploadedBy" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "team_members" m WHERE m.id = f."uploadedBy");

UPDATE "project_links" l
SET "addedBy" = NULL
WHERE l."addedBy" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "team_members" m WHERE m.id = l."addedBy");

CREATE INDEX "project_files_uploadedBy_idx" ON "project_files"("uploadedBy");
CREATE INDEX "project_links_addedBy_idx" ON "project_links"("addedBy");
CREATE INDEX "project_notes_updatedBy_idx" ON "project_notes"("updatedBy");

ALTER TABLE "project_files" ADD CONSTRAINT "project_files_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_links" ADD CONSTRAINT "project_links_addedBy_fkey"
  FOREIGN KEY ("addedBy") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
