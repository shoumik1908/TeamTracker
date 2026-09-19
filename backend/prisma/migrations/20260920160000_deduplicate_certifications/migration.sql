-- TT-093: add @@unique([name, provider]) to certifications.
--
-- The constraint cannot simply be added: production holds eight rows where there should
-- be two — six copies of "Claude Certified Associate – Foundations" and two of
-- "Data Engineer Associate". Five people hold assignments against five *different*
-- copies of the same certification, so the partner audit undercounts and any lookup by
-- name binds to whichever row it happens to find.
--
-- This merges the duplicates first. It is written against the shape of the data rather
-- than against specific ids, so it behaves correctly whatever has changed by the time it
-- is deployed:
--
--   * the survivor is the earliest-created row in each (name, provider) group — the
--     entry the catalog originally had; the rest are accidental re-creations
--   * where a member holds more than one copy of the same certification, exactly one of
--     their assignments survives and is pointed at the surviving catalog row; the others
--     are duplicates of it and are removed. @@unique([memberId, certificationId]) already
--     forbids that state in canonical form. Verified against production: no member holds
--     more than one copy today, so this deletes no assignment there
--   * only then are the now-unreferenced duplicate rows deleted
--
-- Which of a member's copies survives: the one carrying the most evidence, so merging
-- never discards a completion in favour of an untouched row — an uploaded certificate
-- first, then COMPLETED, then the furthest progress, then the earliest created. The
-- earlier version of this migration always kept whichever assignment already pointed at
-- the surviving catalog row regardless of its state, and crashed outright when a member
-- held two copies that both had to move (both were redirected in one UPDATE and collided
-- on the unique index). Deleting before repointing is what makes that case safe.
--
-- assigned_certifications.certificationId is the only foreign key into this table.

-- 1. Within each member's copies of the same certification, keep only the best one.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY name, COALESCE(provider, '') ORDER BY "createdAt", id
         ) AS keeper
  FROM certifications
),
grouped AS (
  SELECT a.id,
         ROW_NUMBER() OVER (
           PARTITION BY a."memberId", r.keeper
           ORDER BY (a."certificateUrl" IS NOT NULL) DESC,
                    (a.status = 'COMPLETED') DESC,
                    a.progress DESC,
                    a."createdAt",
                    a.id
         ) AS rn
  FROM assigned_certifications a
  JOIN ranked r ON a."certificationId" = r.id
)
DELETE FROM assigned_certifications a
USING grouped g
WHERE a.id = g.id AND g.rn > 1;

-- 2. Point each surviving assignment at the surviving certification. After step 1 there
--    is at most one per (member, keeper), so this cannot collide.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY name, COALESCE(provider, '') ORDER BY "createdAt", id
         ) AS keeper
  FROM certifications
)
UPDATE assigned_certifications a
SET "certificationId" = r.keeper
FROM ranked r
WHERE a."certificationId" = r.id
  AND r.keeper <> r.id;

-- 3. Drop the duplicate catalog rows, now unreferenced.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY name, COALESCE(provider, '') ORDER BY "createdAt", id
         ) AS keeper
  FROM certifications
)
DELETE FROM certifications c
USING ranked r
WHERE c.id = r.id AND r.keeper <> r.id;

-- 4. Now the constraint can be created.
CREATE UNIQUE INDEX "certifications_name_provider_key" ON "certifications"("name", "provider");
