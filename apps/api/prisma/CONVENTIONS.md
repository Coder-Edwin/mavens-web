# Prisma migration & seed conventions

Agreed during Phase 0, to keep the CRM phases predictable.

## Schema changes

1. Edit `schema.prisma`.
2. `npx prisma migrate dev --name <short_snake_name>` — creates the migration,
   applies it to the dev DB, and regenerates the client.
3. If `migrate dev` refuses in a non-interactive shell (it does this when it
   detects a potentially destructive step, e.g. adding a `@unique` index to a
   column that could already hold duplicates): hand-write the migration
   instead —
   ```
   mkdir prisma/migrations/$(date +%Y%m%d%H%M%S)_<name>
   # write migration.sql
   npx prisma migrate deploy      # applies pending migrations, non-interactive
   npx prisma generate            # migrate deploy does NOT regenerate the client
   ```
4. **Always** end with a client that matches the schema. `migrate dev`
   regenerates automatically; every other path needs an explicit
   `npx prisma generate`.
5. **Restart `npm run start:dev`** after any migration — the running Node
   process holds a stale `@prisma/client` and will 500 on the new models until
   it reloads.

## Applied migrations are immutable

Never edit a migration that has run anywhere. To correct or extend it, add a
follow-up migration. `20260907081639_backfill_open_challenge_owner` is an
example: the column + index landed in one migration, the data backfill in a
later one.

## Data / backfill migrations (MySQL specifics)

- Resolve duplicates **before** adding a `@unique` index, or the index
  creation fails. Use `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` in a
  doubly-nested derived table (MySQL can't `UPDATE` a table it also `SELECT`s
  from directly).
- Keep every statement idempotent so a re-run is a no-op.
- `TEXT`/`JSON`/`BLOB` columns can't carry a `DEFAULT` — set the value in
  application code (`pgn: ''`, not `@default("")`).

## Seeds

- `prisma/seed.ts`, run with `npx prisma db seed`.
- Must be idempotent: `upsert`, or find-then-create per row. Re-running the
  seed on a populated DB should change nothing.

## DB-touching tests

- Never point at `DATABASE_URL`. Require `DATABASE_URL_TEST`, fail fast if
  missing, and provision + drop a uniquely-named scratch database on that
  server. Pattern: `test/backfill-open-challenge.int.ts`, run via
  `npm run test:int`. These stay out of the mocked `npm test` suite
  (`testRegex` matches only `*.spec.ts`).
