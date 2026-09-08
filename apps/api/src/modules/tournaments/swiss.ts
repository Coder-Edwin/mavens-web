// A pragmatic Swiss pairing engine — "good enough for a club", not a
// FIDE-Dutch implementation. Given the standings so far it produces the
// next round's boards: pair within score groups, avoid rematches where
// possible, keep colours roughly balanced, and hand the odd player a bye
// (preferring someone who has not had one).

export interface SwissPlayer {
  id: string;
  score: number;
  seed: number; // lower = stronger; unseeded players should be passed a large value
  whites: number;
  blacks: number;
  opponentIds: Set<string>;
  hadBye: boolean;
}

export interface SwissPairing {
  whiteId: string;
  blackId: string | null; // null only for the bye board
}

export interface SwissResult {
  pairings: SwissPairing[];
  byeId: string | null;
}

function byStanding(a: SwissPlayer, b: SwissPlayer): number {
  return b.score - a.score || a.seed - b.seed;
}

export function pairSwiss(
  players: SwissPlayer[],
  opts: { firstRound?: boolean } = {}
): SwissResult {
  const ranked = [...players].sort(byStanding);

  let byeId: string | null = null;
  let pool = ranked;
  if (pool.length % 2 === 1) {
    // lowest-ranked player who has not had a bye yet, else the lowest-ranked
    const lowestFirst = [...pool].reverse();
    const pick = lowestFirst.find((p) => !p.hadBye) ?? lowestFirst[0];
    byeId = pick.id;
    pool = pool.filter((p) => p.id !== pick.id);
  }

  if (pool.length === 0) return { pairings: [], byeId };

  if (opts.firstRound) {
    const half = pool.length / 2;
    const top = pool.slice(0, half);
    const bottom = pool.slice(half);
    const pairings = top.map((p, i) =>
      // alternate which side gets white so colours even out across boards
      i % 2 === 0
        ? { whiteId: p.id, blackId: bottom[i].id }
        : { whiteId: bottom[i].id, blackId: p.id }
    );
    return { pairings, byeId };
  }

  const paired = new Set<string>();
  const pairings: SwissPairing[] = [];

  for (let i = 0; i < pool.length; i += 1) {
    const p = pool[i];
    if (paired.has(p.id)) continue;

    let opponent: SwissPlayer | null = null;
    let fallback: SwissPlayer | null = null;
    for (let j = i + 1; j < pool.length; j += 1) {
      const q = pool[j];
      if (paired.has(q.id)) continue;
      if (fallback === null) fallback = q;
      if (!p.opponentIds.has(q.id)) {
        opponent = q;
        break;
      }
    }
    const chosen = opponent ?? fallback;
    if (!chosen) continue; // only if the pool was odd, which it isn't here

    paired.add(p.id);
    paired.add(chosen.id);

    // whoever is more "due white" (more blacks than whites) gets white;
    // ties go to the higher-ranked player, which is `p` (pool is sorted).
    const pDue = p.blacks - p.whites;
    const qDue = chosen.blacks - chosen.whites;
    if (qDue > pDue) {
      pairings.push({ whiteId: chosen.id, blackId: p.id });
    } else {
      pairings.push({ whiteId: p.id, blackId: chosen.id });
    }
  }

  return { pairings, byeId };
}

export const PAIRING_RESULTS = ['WHITE_WIN', 'BLACK_WIN', 'DRAW'] as const;
export type PairingResultInput = (typeof PAIRING_RESULTS)[number];

/** Points a registration earns from one finished pairing. */
export function pointsFor(
  registrationId: string,
  pairing: { whiteRegistrationId: string; blackRegistrationId: string | null; result: string | null }
): number {
  if (!pairing.result) return 0;
  if (pairing.result === 'BYE') {
    return pairing.whiteRegistrationId === registrationId ? 1 : 0;
  }
  const isWhite = pairing.whiteRegistrationId === registrationId;
  const isBlack = pairing.blackRegistrationId === registrationId;
  if (!isWhite && !isBlack) return 0;
  if (pairing.result === 'DRAW') return 0.5;
  if (pairing.result === 'WHITE_WIN') return isWhite ? 1 : 0;
  if (pairing.result === 'BLACK_WIN') return isBlack ? 1 : 0;
  return 0;
}
