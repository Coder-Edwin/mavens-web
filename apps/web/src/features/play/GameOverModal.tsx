import { Link } from 'react-router-dom';
import type { GameResultType } from '@/lib/games';

const TITLE: Record<string, string> = {
  checkmate: 'Checkmate!',
  resignation: 'Resignation',
  timeout: 'Time out!',
  stalemate: 'Stalemate',
  threefold: 'Draw by repetition',
  'insufficient-material': 'Insufficient material',
  'fifty-move': 'Fifty-move rule'
};

function outcomeLine(
  result: GameResultType,
  myColor: 'white' | 'black' | null
): { text: string; tone: 'win' | 'lose' | 'draw' } {
  if (result === 'DRAW') return { text: "It's a draw", tone: 'draw' };
  const whiteWon = result === 'WHITE_WINS';
  if (!myColor) {
    return { text: whiteWon ? 'White wins' : 'Black wins', tone: 'draw' };
  }
  const iWon = whiteWon === (myColor === 'white');
  return iWon
    ? { text: 'You won', tone: 'win' }
    : { text: 'You lost', tone: 'lose' };
}

export function GameOverModal({
  result,
  reason,
  myColor,
  pgn,
  onClose
}: {
  result: GameResultType;
  reason: string;
  myColor: 'white' | 'black' | null;
  pgn: string;
  onClose: () => void;
}) {
  const title = TITLE[reason] ?? 'Game over';
  const { text, tone } = outcomeLine(result, myColor);
  const accent = tone === 'win' ? 'var(--leaf, #6b7f63)' : tone === 'lose' ? 'var(--red)' : 'var(--gold-soft)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,10,10,0.6)',
        zIndex: 60
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderTop: `4px solid ${accent}`,
          borderRadius: 12,
          padding: '26px 28px',
          width: 340,
          maxWidth: '90vw',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: 20,
            cursor: 'pointer',
            lineHeight: 1
          }}
        >
          ×
        </button>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.01em' }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: accent }}>{text}</div>
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--muted)'
          }}
        >
          {reason.replace(/-/g, ' ')}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
          <Link
            to="/app/analysis"
            state={pgn ? { pgn } : undefined}
            className="btn btn-gold btn-sm"
          >
            Analyse
          </Link>
          <Link to="/app/play" className="btn btn-ghost btn-sm">
            Back to lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
