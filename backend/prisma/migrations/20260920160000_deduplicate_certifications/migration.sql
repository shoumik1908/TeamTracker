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
--   * assignments move to the survivor
--   * an assignment that cannot move because that member already holds the survivor is a
--     literal duplicate of itself and is removed; @@unique([memberId, certificationId])
--     already forbids that state in canonical form. Verified against production: zero
--     such rows today, so this deletes nothing there
--   * only then are the now-unreferenced duplicate rows deleted
--
-- assigned_certifications.certificationId is the only foreign key into this table.

-- 1. Move assignments onto the surviving certification, where that does not collide.
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
  AND r.keeper <> r.id
  AND NOT EXISTS (
    SELECT 1 FROM assigned_certifications existing
    WHERE existing."memberId" = a."memberId"
      AND existing."certificationId" = r.keeper
  );

-- 2. Remove assignments that could not move because the member already holds the keeper.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY name, COALESCE(provider, '') ORDER BY "createdAt", id
         ) AS keeper
  FROM certifications
)
DELETE FROM assigned_certifications a
USING ranked r
WHERE a."certificationId" = r.id AND r.keeper <> r.id;

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
