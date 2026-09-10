import { describe, it, expect } from 'vitest';
import {
  checkStyles,
  isLegalTarget,
  isPromotionMove,
  lastMoveStyles,
  mergeStyles,
  moveHintStyles,
  outcomeOf,
  ownerOf,
  sideToMove
} from './chess-hints';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('moveHintStyles', () => {
  it('marks the from-square and every legal destination for a knight', () => {
    const styles = moveHintStyles(START, 'g1');
    expect(styles.g1).toBeDefined(); // selected
    expect(styles.f3).toBeDefined();
    expect(styles.h3).toBeDefined();
    expect(Object.keys(styles).sort()).toEqual(['f3', 'g1', 'h3']);
  });

  it('returns nothing for an empty square', () => {
    expect(moveHintStyles(START, 'e4')).toEqual({});
  });

  it('distinguishes a capture target with a ring style', () => {
    // white pawn d4, black pawn e5 -> dxe5 is a capture
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';
    const styles = moveHintStyles(fen, 'd4');
    expect(styles.d5?.background).toContain('radial-gradient'); // quiet push -> dot
    expect(styles.e5?.background).toContain('transparent 60%'); // capture -> ring
  });
});

describe('isLegalTarget', () => {
  it('accepts a legal move and rejects an illegal one', () => {
    expect(isLegalTarget(START, 'e2', 'e4')).toBe(true);
    expect(isLegalTarget(START, 'e2', 'e5')).toBe(false);
  });
});

describe('ownerOf / sideToMove', () => {
  it('reads the piece colour on a square', () => {
    expect(ownerOf(START, 'e2')).toBe('w');
    expect(ownerOf(START, 'e7')).toBe('b');
    expect(ownerOf(START, 'e4')).toBeNull();
  });
  it('reads the side to move from the FEN', () => {
    expect(sideToMove(START)).toBe('w');
    expect(sideToMove(START.replace(' w ', ' b '))).toBe('b');
  });
});

describe('checkStyles', () => {
  it('glows the side-to-move king when it is in check', () => {
    // black king on e8 checked by a white queen on f7
    const fen = 'rnbqkbnr/pppppQ1p/8/8/8/8/PPPP1PPP/RNB1KBNR b KQkq - 0 1';
    const styles = checkStyles(fen);
    expect(Object.keys(styles)).toEqual(['e8']);
    expect(styles.e8.background).toContain('rgba(220,32,32');
  });

  it('is empty when no one is in check', () => {
    expect(checkStyles('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual({});
  });
});

describe('outcomeOf', () => {
  it('names the winner on checkmate (fool’s mate position)', () => {
    // after 1. f3 e5 2. g4 Qh4# — white is mated
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(outcomeOf(fen)).toEqual({ kind: 'checkmate', winner: 'Black' });
  });
  it('reports a stalemate', () => {
    expect(outcomeOf('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toEqual({ kind: 'stalemate', winner: null });
  });
  it('is null for an ongoing position', () => {
    expect(outcomeOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });
});

describe('isPromotionMove', () => {
  it('is true for a pawn stepping onto the last rank', () => {
    const fen = '4k3/4P3/8/8/8/8/8/4K3 w - - 0 1';
    expect(isPromotionMove(fen, 'e7', 'e8')).toBe(true);
  });
  it('is false for a non-pawn or a non-final rank', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(isPromotionMove(start, 'e2', 'e4')).toBe(false);
    expect(isPromotionMove(start, 'g1', 'f3')).toBe(false);
  });
});

describe('mergeStyles', () => {
  it('later maps win, but box-shadows stack', () => {
    const merged = mergeStyles(lastMoveStyles('e2', 'e4'), moveHintStyles(START, 'e2'));
    // e2 carries both the last-move tint and the selected tint
    expect(merged.e2.boxShadow).toContain(',');
    expect(merged.e4).toBeDefined();
  });
});
