import { pairSwiss, pointsFor, type SwissPlayer } from './swiss';

const p = (over: Partial<SwissPlayer> & { id: string }): SwissPlayer => ({
  score: 0,
  seed: 999,
  whites: 0,
  blacks: 0,
  opponentIds: new Set(),
  hadBye: false,
  ...over
});

describe('pairSwiss', () => {
  it('round 1 pairs the top half against the bottom half', () => {
    const players = [1, 2, 3, 4, 5, 6].map((n) => p({ id: `s${n}`, seed: n }));
    const { pairings, byeId } = pairSwiss(players, { firstRound: true });
    expect(byeId).toBeNull();
    // 6 players -> boards s1-s4, s2-s5, s3-s6 (colours alternate)
    const boards = pairings.map((x) => [x.whiteId, x.blackId].sort().join('-')).sort();
    expect(boards).toEqual(['s1-s4', 's2-s5', 's3-s6']);
  });

  it('gives the odd player out a bye — preferring one who has not had a bye', () => {
    const players = [
      p({ id: 'a', seed: 1, score: 2 }),
      p({ id: 'b', seed: 2, score: 2 }),
      p({ id: 'c', seed: 3, score: 1 }),
      p({ id: 'd', seed: 4, score: 1 }),
      p({ id: 'e', seed: 5, score: 0, hadBye: true }) // already had one
    ];
    const { byeId, pairings } = pairSwiss(players);
    expect(byeId).toBe('d'); // lowest-ranked without a prior bye
    expect(pairings).toHaveLength(2);
  });

  it('later rounds pair within score groups and avoid rematches', () => {
    const players = [
      p({ id: 'a', seed: 1, score: 1, opponentIds: new Set(['b']) }),
      p({ id: 'b', seed: 2, score: 1, opponentIds: new Set(['a']) }),
      p({ id: 'c', seed: 3, score: 0, opponentIds: new Set(['d']) }),
      p({ id: 'd', seed: 4, score: 0, opponentIds: new Set(['c']) })
    ];
    const { pairings } = pairSwiss(players);
    const boards = pairings.map((x) => [x.whiteId, x.blackId].sort().join('-')).sort();
    // a & b (score 1) can't replay each other -> a-c and b-d
    expect(boards).toEqual(['a-c', 'b-d']);
  });

  it('balances colours: the player more due white gets it', () => {
    const players = [
      p({ id: 'a', seed: 1, score: 1, whites: 2, blacks: 0 }), // had 2 whites
      p({ id: 'b', seed: 2, score: 1, whites: 0, blacks: 2 }) // due white
    ];
    const { pairings } = pairSwiss(players);
    expect(pairings[0]).toEqual({ whiteId: 'b', blackId: 'a' });
  });

  it('falls back to a rematch when every remaining opponent has been played', () => {
    const players = [
      p({ id: 'a', seed: 1, opponentIds: new Set(['b']) }),
      p({ id: 'b', seed: 2, opponentIds: new Set(['a']) })
    ];
    const { pairings } = pairSwiss(players);
    expect(pairings).toHaveLength(1);
    expect([pairings[0].whiteId, pairings[0].blackId].sort()).toEqual(['a', 'b']);
  });
});

describe('pointsFor', () => {
  const board = { whiteRegistrationId: 'w', blackRegistrationId: 'b', result: 'WHITE_WIN' as string | null };

  it('awards the win to the correct colour', () => {
    expect(pointsFor('w', board)).toBe(1);
    expect(pointsFor('b', board)).toBe(0);
  });

  it('splits a draw', () => {
    expect(pointsFor('w', { ...board, result: 'DRAW' })).toBe(0.5);
    expect(pointsFor('b', { ...board, result: 'DRAW' })).toBe(0.5);
  });

  it('gives a full point for a bye (white slot only)', () => {
    expect(pointsFor('w', { whiteRegistrationId: 'w', blackRegistrationId: null, result: 'BYE' })).toBe(1);
  });

  it('is zero for an unplayed pairing', () => {
    expect(pointsFor('w', { ...board, result: null })).toBe(0);
  });
});
