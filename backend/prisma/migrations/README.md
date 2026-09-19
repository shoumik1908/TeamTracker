# Migrations

`0_init` is a **squashed baseline** generated from `schema.prisma`. It replaces the
seven hand-edited migrations that were here before, which could not run on an empty
database: they added foreign keys to `users` and `roles`, but no migration ever
created those tables (audit TT-001), and together they created only 16 of the 42
tables the schema declares (audit TT-002).

## Fresh database (local dev, CI, a new environment)

Nothing special — this is the path that was broken and is now fixed:

```bash
npx prisma migrate deploy
```

## Existing database (production on Render, and any dev DB built with `db push`)

**One-time step, required before the next deploy.** The database already has these
tables, and its `_prisma_migrations` table still lists the seven old migration names.
`migrate deploy` would try to apply `0_init` on top and fail with "type already exists".

Mark the baseline as already applied instead:

```bash
# 1. Confirm the live schema really matches schema.prisma (read-only; expect empty output)
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# 2. Clear the stale history rows, then record the baseline as applied
psql "$DATABASE_URL" -c 'DELETE FROM "_prisma_migrations";'
npx prisma migrate resolve --applied 0_init
```

If step 1 prints any SQL, the live database has drifted from `schema.prisma`. Review
that SQL and apply it (or fold it into a follow-up migration) before running step 2.

## If a migration fails part-way (enum conversions especially)

`20260920120000_promote_status_columns_to_enums` converts seven free-text columns to
real enums with a `USING` cast. The cast fails if any existing row holds a value outside
its enum, naming the column and the offending value:

```
ERROR: invalid input value for enum "PresalesTrack": "Contoso Account"
```

The failure is safe — Postgres runs the migration in a transaction, so nothing is
converted and no data is touched. But Prisma records the attempt and **refuses every
later migration until you clear it**:

```bash
# 1. Find the offending rows (read-only). Repeat per column as the error names them.
psql "$DATABASE_URL" -c \
  "SELECT DISTINCT account FROM presales_opportunities WHERE account NOT IN ('PNB','TNM');"

# 2. Correct or remove those rows.

# 3. Clear the failed attempt, then deploy again.
npx prisma migrate resolve --rolled-back 20260920120000_promote_status_columns_to_enums
npx prisma migrate deploy
```

Check for off-enum values *before* deploying rather than discovering this during one.

## Going forward

Create migrations with `npx prisma migrate dev --name <change>` and commit them.
Never edit `schema.prisma` and deploy with `db push` — that is how this drift started.

`.github/workflows/db-schema.yml` enforces this on every push and pull request: it
runs `migrate deploy` against an empty Postgres and then fails the build if
`migrate diff --exit-code` finds any difference between the resulting database and
`schema.prisma`. A schema edit without a matching migration will not go green.
