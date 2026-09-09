import type { CSSProperties } from 'react';
import { Chess } from 'chess.js';

export type SquareStyles = Record<string, CSSProperties>;

// A dot on an empty legal target, a ring on a capturable one — the
// lichess / chess.com convention. `boxShadow: inset …` tints a square
// without wiping its base colour (unlike setting `background`).
const DOT: CSSProperties = {
  background: 'radial-gradient(circle, rgba(20,20,20,0.28) 19%, transparent 21%)'
};
const CAPTURE: CSSProperties = {
  background: 'radial-gradient(circle, transparent 60%, rgba(20,20,20,0.30) 62%, transparent 72%)'
};
const SELECTED: CSSProperties = { boxShadow: 'inset 0 0 0 100px rgba(255,213,79,0.40)' };
const LAST_MOVE: CSSProperties = { boxShadow: 'inset 0 0 0 100px rgba(155,199,0,0.26)' };
const IN_CHECK: CSSProperties = {
  background:
    'radial-gradient(circle, rgba(220,32,32,0.85) 0%, rgba(220,32,32,0.40) 55%, transparent 72%)'
};

interface VerboseMove {
  to: string;
  captured?: string;
  flags: string;
}

/**
 * Styles for the from-square plus every square the piece on it may legally
 * move to. `fen` is the position; `from` an algebraic square (e.g. "e2").
 */
export function moveHintStyles(fen: string, from: string): SquareStyles {
  const styles: SquareStyles = {};
  let moves: VerboseMove[];
  try {
    const chess = new Chess(fen);
    moves = chess.moves({ square: from as never, verbose: true }) as unknown as VerboseMove[];
  } catch {
    return styles;
  }
  if (!moves || moves.length === 0) return styles;
  styles[from] = { ...SELECTED };
  for (const m of moves) {
    const isCapture = Boolean(m.captured) || m.flags.includes('e');
    styles[m.to] = { ...(isCapture ? CAPTURE : DOT) };
  }
  return styles;
}

/** Highlight the last move's from/to squares. */
export function lastMoveStyles(from?: string | null, to?: string | null): SquareStyles {
  const styles: SquareStyles = {};
  if (from) styles[from] = { ...LAST_MOVE };
  if (to) styles[to] = { ...LAST_MOVE };
  return styles;
}

/** A red glow on the side-to-move's king when it is in check. */
export function checkStyles(fen: string): SquareStyles {
  try {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return {};
    const stm = chess.turn();
    for (const rank of chess.board()) {
      for (const cell of rank) {
        if (cell && cell.type === 'k' && cell.color === stm) {
          return { [cell.square]: { ...IN_CHECK } };
        }
      }
    }
  } catch {
    /* invalid fen -> no highlight */
  }
  return {};
}

/** Later maps win on key collisions; box-shadows are merged so a square can
 *  carry both a last-move tint and a selection tint. */
export function mergeStyles(...maps: SquareStyles[]): SquareStyles {
  const out: SquareStyles = {};
  for (const map of maps) {
    for (const [square, style] of Object.entries(map)) {
      const prev = out[square];
      if (prev?.boxShadow && style.boxShadow && prev.boxShadow !== style.boxShadow) {
        out[square] = { ...prev, ...style, boxShadow: `${prev.boxShadow}, ${style.boxShadow}` };
      } else {
        out[square] = { ...prev, ...style };
      }
    }
  }
  return out;
}

/** The colour whose turn it is in a FEN, or null. */
export function ownerOf(fen: string, square: string): 'w' | 'b' | null {
  try {
    const piece = new Chess(fen).get(square as never) as { color: 'w' | 'b' } | null;
    return piece ? piece.color : null;
  } catch {
    return null;
  }
}

export function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** Is `to` a legal destination for the piece on `from`? */
export function isLegalTarget(fen: string, from: string, to: string): boolean {
  try {
    const moves = new Chess(fen).moves({ square: from as never, verbose: true }) as unknown as {
      to: string;
    }[];
    return moves.some((m) => m.to === to);
  } catch {
    return false;
  }
}

/** Would moving from→to promote a pawn? (pawn on `from`, last rank on `to`) */
export function isPromotionMove(fen: string, from: string, to: string): boolean {
  try {
    const piece = new Chess(fen).get(from as never) as { type: string; color: 'w' | 'b' } | null;
    if (!piece || piece.type !== 'p') return false;
    const rank = to[1];
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
  } catch {
    return false;
  }
}
