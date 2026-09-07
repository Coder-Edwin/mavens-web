/**
 * Integration test for migration 20260907081639_backfill_open_challenge_owner.
 *
 * Runs against a THROWAWAY database it creates and drops itself. It refuses to
 * run without DATABASE_URL_TEST and never touches DATABASE_URL. What it proves:
 * after upgrading a DB that already holds "legacy" PENDING challenges
 * (openChallengeOwnerId = NULL), the one-open-challenge-per-user invariant
 * holds — duplicates collapse to the newest, ownership is backfilled, and a
 * second open challenge for that user is then rejected by the unique index.
 *
 *   DATABASE_URL_TEST="mysql://root:devpassword@localhost:3306/anything" \
 *     npm run test:int        # from apps/api
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import mariadb from 'mariadb';

const MIGRATIONS_DIR = join(__dirname, '../prisma/migrations');
const BACKFILL_MIGRATION = '20260907081639_backfill_open_challenge_owner';

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) {
  fail(
    'DATABASE_URL_TEST is not set.\n' +
      '  This test CREATEs and DROPs a disposable database and must never use\n' +
      '  DATABASE_URL. Point DATABASE_URL_TEST at a MySQL server you can spare\n' +
      '  (the database name in the URL is ignored — a uniquely-named scratch db\n' +
      '  is created on that server and dropped afterwards).'
  );
}
if (TEST_URL === process.env.DATABASE_URL) {
  fail('DATABASE_URL_TEST must not equal DATABASE_URL.');
}

async function main() {
  const u = new URL(TEST_URL!);
  const server = {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    multipleStatements: true
  };
  const scratchDb = `mavens_migtest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  let failures = 0;
  const check = (label: string, ok: boolean) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) failures += 1;
  };

  const admin = await mariadb.createConnection(server);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let conn: any;
  try {
    await admin.query(`CREATE DATABASE \`${scratchDb}\``);
    conn = await mariadb.createConnection({ ...server, database: scratchDb });

    // Apply every migration up to — but not including — the backfill.
    const migrations = readdirSync(MIGRATIONS_DIR)
      .filter((d) => /^\d+_/.test(d))
      .sort();
    let applied = 0;
    for (const dir of migrations) {
      if (dir === BACKFILL_MIGRATION) break;
      // eslint-disable-next-line no-await-in-loop
      await conn.query(readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'));
      applied += 1;
    }
    console.log(`Applied ${applied} migrations, stopping before ${BACKFILL_MIGRATION}`);

    // Two disposable users.
    const now = new Date();
    await conn.query(
      `INSERT INTO User (id, email, passwordHash, role, createdAt, updatedAt) VALUES
        ('u-A', 'a@migtest.local', 'x', 'STUDENT', ?, ?),
        ('u-B', 'b@migtest.local', 'x', 'STUDENT', ?, ?)`,
      [now, now, now, now]
    );

    // Legacy PENDING challenges: openChallengeOwnerId = NULL. u-A has three
    // (duplicates), u-B has one.
    const seed = (id: string, owner: string, ageMinutes: number) =>
      conn.query(
        `INSERT INTO Game (id, whiteId, status, openChallengeOwnerId, fen, pgn, createdAt, updatedAt)
         VALUES (?, ?, 'PENDING', NULL, 'startpos', '', ?, ?)`,
        [id, owner, new Date(now.getTime() - ageMinutes * 60_000), now]
      );
    await seed('g-a-old', 'u-A', 40);
    await seed('g-a-mid', 'u-A', 25);
    await seed('g-a-new', 'u-A', 3); // newest — must survive
    await seed('g-b', 'u-B', 15);

    // Apply the migration under test.
    await conn.query(
      readFileSync(join(MIGRATIONS_DIR, BACKFILL_MIGRATION, 'migration.sql'), 'utf8')
    );

    const rows = (await conn.query(
      `SELECT id, status, openChallengeOwnerId AS owner FROM Game
       WHERE id IN ('g-a-old', 'g-a-mid', 'g-a-new', 'g-b')`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any[];
    const g = (id: string) => rows.find((r) => r.id === id);

    check('older duplicate g-a-old was abandoned', g('g-a-old').status === 'ABANDONED');
    check('older duplicate g-a-mid was abandoned', g('g-a-mid').status === 'ABANDONED');
    check('newest challenge g-a-new is still PENDING', g('g-a-new').status === 'PENDING');
    check('g-a-new is owned by u-A', g('g-a-new').owner === 'u-A');
    check("u-B's lone challenge is still PENDING", g('g-b').status === 'PENDING');
    check("u-B's challenge is owned by u-B", g('g-b').owner === 'u-B');
    check(
      'abandoned rows released the ownership slot',
      g('g-a-old').owner === null && g('g-a-mid').owner === null
    );

    let rejected = false;
    try {
      await conn.query(
        `INSERT INTO Game (id, whiteId, status, openChallengeOwnerId, fen, pgn, createdAt, updatedAt)
         VALUES ('g-a-2', 'u-A', 'PENDING', 'u-A', 'x', '', ?, ?)`,
        [now, now]
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      rejected = err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062;
    }
    check('a second open challenge for u-A is now rejected by the unique index', rejected);

    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  } finally {
    await conn?.end().catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS \`${scratchDb}\``).catch(() => undefined);
    await admin.end().catch(() => undefined);
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
