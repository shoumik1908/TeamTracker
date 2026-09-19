-- TT-090: promote the free-text status columns to real enums.
--
-- Prisma's own diff for this emits DROP COLUMN + ADD COLUMN for every one of these,
-- which would discard every existing value — and would fail outright on
-- presales_opportunities.account, which is NOT NULL with no default. This migration is
-- written by hand so each column is converted in place with a USING cast and keeps its
-- data. Verified against a database seeded with the values production actually holds.
--
-- The existing default has to be dropped before the type changes: it is a text literal
-- and cannot be cast implicitly. It is restored immediately afterwards.

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('Active', 'Benched');
CREATE TYPE "ActionItemStatus" AS ENUM ('open', 'completed', 'in_progress', 'blocked');
CREATE TYPE "ActionItemPriority" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "BlockerStatus" AS ENUM ('open', 'resolved');
CREATE TYPE "PresalesTrack" AS ENUM ('PNB', 'TNM');
CREATE TYPE "StageChangeSource" AS ENUM ('manual', 'ai_suggested');

-- team_members.status
ALTER TABLE "team_members" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "team_members" ALTER COLUMN "status" TYPE "MemberStatus" USING "status"::"MemberStatus";
ALTER TABLE "team_members" ALTER COLUMN "status" SET DEFAULT 'Active';

-- meeting_action_items.status and .priority
ALTER TABLE "meeting_action_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "meeting_action_items" ALTER COLUMN "status" TYPE "ActionItemStatus" USING "status"::"ActionItemStatus";
ALTER TABLE "meeting_action_items" ALTER COLUMN "status" SET DEFAULT 'open';
ALTER TABLE "meeting_action_items" ALTER COLUMN "priority" TYPE "ActionItemPriority" USING "priority"::"ActionItemPriority";

-- blockers_risks.status
ALTER TABLE "blockers_risks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "blockers_risks" ALTER COLUMN "status" TYPE "BlockerStatus" USING "status"::"BlockerStatus";
ALTER TABLE "blockers_risks" ALTER COLUMN "status" SET DEFAULT 'open';

-- presales_opportunities.account
ALTER TABLE "presales_opportunities" ALTER COLUMN "account" TYPE "PresalesTrack" USING "account"::"PresalesTrack";

-- stage_change_logs.track and .source
ALTER TABLE "stage_change_logs" ALTER COLUMN "track" TYPE "PresalesTrack" USING "track"::"PresalesTrack";
ALTER TABLE "stage_change_logs" ALTER COLUMN "source" TYPE "StageChangeSource" USING "source"::"StageChangeSource";
