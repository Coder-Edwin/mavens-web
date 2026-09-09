import { describe, it, expect } from 'vitest';
import { formatClock, liveClock } from './games';

const base = {
  status: 'ACTIVE' as const,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // white to move
  initialSeconds: 600,
  whiteMs: 300_000,
  blackMs: 250_000
};

describe('liveClock', () => {
  const now = 2_000_000;

  it('ticks the side to move and freezes the other', () => {
    const c = liveClock({ ...base, clockUpdatedAt: new Date(now - 5_000).toISOString() }, now);
    expect(c).toEqual({ whiteMs: 295_000, blackMs: 250_000, running: 'w' });
  });

  it('does not tick a finished game', () => {
    const c = liveClock(
      { ...base, status: 'FINISHED', clockUpdatedAt: new Date(now - 5_000).toISOString() },
      now
    );
    expect(c).toEqual({ whiteMs: 300_000, blackMs: 250_000, running: null });
  });

  it('clamps to zero and returns nulls for an untimed game', () => {
    expect(liveClock({ ...base, whiteMs: 2_000, clockUpdatedAt: new Date(now - 9_000).toISOString() }, now).whiteMs).toBe(0);
    expect(liveClock({ ...base, initialSeconds: null, whiteMs: null, blackMs: null, clockUpdatedAt: null }, now)).toEqual({
      whiteMs: null,
      blackMs: null,
      running: null
    });
  });
});

describe('formatClock', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(3_661_000)).toBe('1:01:01');
    expect(formatClock(null)).toBe('--:--');
    expect(formatClock(-50)).toBe('0:00');
  });
});
