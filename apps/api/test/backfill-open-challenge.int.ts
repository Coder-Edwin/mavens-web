/**
 * Integration test for migration 20260907081639_backfill_open_challenge_owner.
 *
 * Proves that after the upgrade runs against a database that already holds
 * "legacy" PENDING challenges (openChallengeOwnerId = NULL), the
 * one-open-challenge-per-user invariant holds:
 *   - duplicate PENDING challenges per user are collapsed to the newest,
 *     the rest ABANDONED
 *   - each surviving open challenge has openChallengeOwnerId backfilled
 *   - the unique index then rejects a second open challenge for that user
 *
 * Needs a live database. Run with:  npm run test:int   (from apps/api)
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const MIGRATION_SQL = join(
  __dirname,
  '../prisma/migrations/20260907081639_backfill_open_challenge_owner/migration.sql'
);

function statements(sqlPath: string): string[] {
  return readFileSync(sqlPath, 'utf8')
    .split(/;\s*[\r\n]/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
}

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });
  const [userA, userB] = await prisma.user.findMany({ take: 2 });
  if (!userA || !userB) throw new Error('need at least two seeded users');

  const scope = {
    OR: [
      { whiteId: userA.id },
      { blackId: userA.id },
      { whiteId: userB.id },
      { blackId: userB.id }
    ]
  };
  await prisma.game.deleteMany({ where: scope });

  // Legacy rows: PENDING, owner NULL. A has three; B has one.
  const legacy = (owner: string, ageMinutes: number) =>
    prisma.game.create({
      data: {
        whiteId: owner,
        status: 'PENDING',
        openChallengeOwnerId: null,
        fen: 'startpos',
        pgn: '',
        createdAt: new Date(Date.now() - ageMinutes * 60_000)
      }
    });
  const aOld = await legacy(userA.id, 40);
  const aMid = await legacy(userA.id, 25);
  const aNew = await legacy(userA.id, 3); // newest — must survive
  const bOne = await legacy(userB.id, 15);

  console.log('Running migration statements…');
  for (const sql of statements(MIGRATION_SQL)) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.$executeRawUnsafe(sql);
  }

  const after = await prisma.game.findMany({
    where: { id: { in: [aOld.id, aMid.id, aNew.id, bOne.id] } }
  });
  const by = (id: string) => after.find((g) => g.id === id)!;

  check('older duplicate #1 was abandoned', by(aOld.id).status === 'ABANDONED');
  check('older duplicate #2 was abandoned', by(aMid.id).status === 'ABANDONED');
  check('newest challenge for A still PENDING', by(aNew.id).status === 'PENDING');
  check('newest challenge for A owned by A', by(aNew.id).openChallengeOwnerId === userA.id);
  check("B's lone challenge still PENDING", by(bOne.id).status === 'PENDING');
  check("B's challenge owned by B", by(bOne.id).openChallengeOwnerId === userB.id);
  check(
    'abandoned rows released the ownership slot',
    by(aOld.id).openChallengeOwnerId === null && by(aMid.id).openChallengeOwnerId === null
  );

  let rejected = false;
  try {
    await prisma.game.create({
      data: { whiteId: userA.id, status: 'PENDING', openChallengeOwnerId: userA.id, fen: 'x', pgn: '' }
    });
  } catch (err) {
    rejected = (err as { code?: string }).code === 'P2002';
  }
  check('a second open challenge for A is now rejected by the unique index', rejected);

  await prisma.game.deleteMany({ where: scope });
  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
