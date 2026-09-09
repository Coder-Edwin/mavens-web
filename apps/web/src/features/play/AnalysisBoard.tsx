import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { Link } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Panel } from '@/components/ui/Primitives';
import {
  isLegalTarget,
  lastMoveStyles,
  mergeStyles,
  moveHintStyles,
  ownerOf,
  sideToMove as sideOf
} from '@/lib/chess-hints';
import { isSoundOn, playMoveSound, setSoundOn } from '@/lib/chess-sound';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface Ply {
  san: string;
  from: string;
  to: string;
  capture: boolean;
  fen: string; // position AFTER this move
}

// Rebuild the ply list by replaying SAN moves from a start FEN.
function replay(startFen: string, sans: string[]): Ply[] {
  const c = new Chess(startFen);
  const out: Ply[] = [];
  for (const san of sans) {
    const m = c.move(san);
    if (!m) break;
    out.push({ san: m.san, from: m.from, to: m.to, capture: /[x]/.test(m.san), fen: c.fen() });
  }
  return out;
}

export function AnalysisBoard() {
  const [startFen, setStartFen] = useState(START_FEN);
  const [plies, setPlies] = useState<Ply[]>([]);
  const [cursor, setCursor] = useState(0); // 0 = start position, k = after plies[k-1]
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [loadText, setLoadText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [soundOn, setSoundOnState] = useState(isSoundOn());

  const wrapRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(420);
  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? 420;
      setBoardWidth(Math.max(260, Math.min(w, 480)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const positionFen = cursor === 0 ? startFen : plies[cursor - 1].fen;
  const sideToMove = positionFen.split(' ')[1] === 'w' ? 'White' : 'Black';
  const lastPly = cursor > 0 ? plies[cursor - 1] : null;

  const squareStyles = useMemo(
    () =>
      mergeStyles(
        lastPly ? lastMoveStyles(lastPly.from, lastPly.to) : {},
        selected ? moveHintStyles(positionFen, selected) : {}
      ),
    [lastPly, selected, positionFen]
  );

  const go = useCallback(
    (next: number) => {
      setSelected(null);
      setCursor(Math.max(0, Math.min(plies.length, next)));
    },
    [plies.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') go(cursor - 1);
      else if (e.key === 'ArrowRight') go(cursor + 1);
      else if (e.key === 'ArrowUp') go(0);
      else if (e.key === 'ArrowDown') go(plies.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, go, plies.length]);

  function applyMove(from: string, to: string): boolean {
    const c = new Chess(positionFen);
    try {
      const m = c.move({ from, to, promotion: 'q' });
      if (!m) return false;
      const capture = /[x]/.test(m.san);
      // Playing from an earlier point rewrites the continuation from there.
      const kept = plies.slice(0, cursor);
      setPlies([...kept, { san: m.san, from: m.from, to: m.to, capture, fen: c.fen() }]);
      setCursor(cursor + 1);
      setSelected(null);
      setNote(null);
      setError(null);
      playMoveSound(capture ? 'capture' : 'move');
      return true;
    } catch {
      return false;
    }
  }

  function onDrop(from: string, to: string): boolean {
    return applyMove(from, to);
  }

  function onSquareClick(square: string) {
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (isLegalTarget(positionFen, selected, square)) {
        applyMove(selected, square);
        return;
      }
    }
    // select a piece belonging to the side to move
    if (ownerOf(positionFen, square) === sideOf(positionFen)) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundOnState(next);
    if (next) playMoveSound('move');
  }

  function loadInput() {
    const text = loadText.trim();
    if (!text) return;
    setError(null);
    setNote(null);
    // Try PGN first (has move numbers or a result), else treat as FEN.
    const looksPgn = /\d\.\s|\[|1-0|0-1|1\/2-1\/2|\*/.test(text);
    if (looksPgn) {
      try {
        const c = new Chess();
        c.loadPgn(text);
        const header = c.header();
        const fromFen = header.FEN && header.SetUp === '1' ? header.FEN : START_FEN;
        const sans = c.history();
        const rebuilt = replay(fromFen, sans);
        setStartFen(fromFen);
        setPlies(rebuilt);
        setCursor(rebuilt.length);
        setNote(`Loaded ${rebuilt.length} half-moves from PGN.`);
        setLoadText('');
        return;
      } catch {
        setError('Could not parse that as PGN.');
        return;
      }
    }
    try {
      // eslint-disable-next-line no-new
      new Chess(text); // throws on an invalid FEN
      setStartFen(text);
      setPlies([]);
      setCursor(0);
      setNote('Loaded position from FEN.');
      setLoadText('');
    } catch {
      setError('That is neither a valid FEN nor a PGN.');
    }
  }

  function reset() {
    setStartFen(START_FEN);
    setPlies([]);
    setCursor(0);
    setNote(null);
    setError(null);
  }

  const pgnText = useMemo(() => {
    if (plies.length === 0) return '';
    const c = new Chess(startFen);
    for (const p of plies) c.move(p.san);
    return c.pgn();
  }, [startFen, plies]);

  async function copy(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNote(`${label} copied.`);
    } catch {
      setNote(`Could not copy the ${label.toLowerCase()}.`);
    }
  }

  const rows = useMemo(() => {
    const startWhite = startFen.split(' ')[1] === 'w';
    const out: { no: number; white?: Ply & { ply: number }; black?: Ply & { ply: number } }[] = [];
    plies.forEach((p, i) => {
      const isWhiteMove = startWhite ? i % 2 === 0 : i % 2 === 1;
      const moveNo = Math.floor((i + (startWhite ? 0 : 1)) / 2) + 1;
      const withPly = { ...p, ply: i + 1 };
      if (isWhiteMove) out.push({ no: moveNo, white: withPly });
      else {
        const last = out[out.length - 1];
        if (last && !last.black && last.no === moveNo) last.black = withPly;
        else out.push({ no: moveNo, black: withPly });
      }
    });
    return out;
  }, [plies, startFen]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Analysis board</div>
          <div className="page-sub">
            <Link to="/app/play" style={{ color: 'var(--gold-soft)' }}>
              ← Play
            </Link>{' '}
            · click or drag a piece to see its moves · ← → to step through
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title={soundOn ? 'Mute move sounds' : 'Unmute move sounds'}
          >
            {soundOn ? '🔊 Sound' : '🔇 Muted'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
          >
            Flip board
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div ref={wrapRef}>
          <Chessboard
            position={positionFen}
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            onPieceDragBegin={(_piece: string, sq: string) => setSelected(sq)}
            boardOrientation={orientation}
            boardWidth={boardWidth}
            showBoardNotation
            customSquareStyles={squareStyles}
            customBoardStyle={{ borderRadius: 8 }}
            customDarkSquareStyle={{ backgroundColor: '#6b7f63' }}
            customLightSquareStyle={{ backgroundColor: '#e9e6d8' }}
            customNotationStyle={{ fontSize: '10px', fontWeight: 600 }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <NavBtn onClick={() => go(0)} disabled={cursor === 0}>⏮</NavBtn>
            <NavBtn onClick={() => go(cursor - 1)} disabled={cursor === 0}>◀</NavBtn>
            <NavBtn onClick={() => go(cursor + 1)} disabled={cursor === plies.length}>▶</NavBtn>
            <NavBtn onClick={() => go(plies.length)} disabled={cursor === plies.length}>⏭</NavBtn>
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center', marginLeft: 6 }}>
              {sideToMove} to move · ply {cursor}/{plies.length}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Moves">
            {rows.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                No moves yet. Play on the board or load a game below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {rows.map((r) => (
                  <span key={r.no} style={{ display: 'inline-flex', gap: 4 }}>
                    <span style={{ color: 'var(--muted)' }}>{r.no}.</span>
                    {r.white && <MoveChip ply={r.white.ply} san={r.white.san} cursor={cursor} onClick={go} />}
                    {r.black && <MoveChip ply={r.black.ply} san={r.black.san} cursor={cursor} onClick={go} />}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => copy(positionFen, 'FEN')}>
                Copy FEN
              </button>
              <button className="btn btn-ghost btn-sm" disabled={!pgnText} onClick={() => copy(pgnText, 'PGN')}>
                Copy PGN
              </button>
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                Reset
              </button>
            </div>
          </Panel>

          <Panel title="Load a position or game">
            <textarea
              value={loadText}
              onChange={(e) => setLoadText(e.target.value)}
              placeholder="Paste a FEN or PGN…"
              style={{
                width: '100%',
                minHeight: 90,
                padding: '9px 11px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--panel-alt)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-gold btn-sm" onClick={loadInput} disabled={!loadText.trim()}>
                Load
              </button>
            </div>
            {error && (
              <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>
                {error}
              </div>
            )}
            {note && !error && (
              <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold-soft)' }}>
                {note}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: ReactNode }) {
  return (
    <button className="btn btn-ghost btn-sm" onClick={onClick} disabled={disabled} style={{ minWidth: 40 }}>
      {children}
    </button>
  );
}

function MoveChip({
  ply,
  san,
  cursor,
  onClick
}: {
  ply: number;
  san: string;
  cursor: number;
  onClick: (n: number) => void;
}) {
  const active = cursor === ply;
  return (
    <button
      onClick={() => onClick(ply)}
      style={{
        border: 'none',
        background: active ? 'var(--gold-soft)' : 'transparent',
        color: active ? '#1c1c1c' : 'var(--text)',
        borderRadius: 4,
        padding: '1px 5px',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 13
      }}
    >
      {san}
    </button>
  );
}
