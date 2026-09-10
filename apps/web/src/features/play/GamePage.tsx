import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Panel } from '@/components/ui/Primitives';
import { CopyLinkButton } from '@/features/play/CopyLinkButton';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PromotionPicker, type PromotionChoice } from '@/features/play/PromotionPicker';
import { GameOverModal } from '@/features/play/GameOverModal';
import {
  checkStyles,
  isLegalTarget,
  isPromotionMove,
  lastMoveStyles,
  mergeStyles,
  moveHintStyles
} from '@/lib/chess-hints';
import {
  isSoundOn,
  playGameOverSound,
  playMoveSound,
  setSoundOn,
  soundForSan
} from '@/lib/chess-sound';
import {
  connectGameSocket,
  formatClock,
  gamesApi,
  liveClock,
  resultText,
  type Game,
  type GameSocket,
  type OverPayload
} from '@/lib/games';
import '@/styles/play.css';

function Seat({
  email,
  color,
  isTurn,
  clockMs,
  clockRunning,
  clockLow
}: {
  email: string | null;
  color: 'w' | 'b';
  isTurn: boolean;
  clockMs?: number | null;
  clockRunning?: boolean;
  clockLow?: boolean;
}) {
  return (
    <div className={`pl-seat${isTurn ? ' turn' : ''}`} style={{ justifyContent: 'space-between' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span className={`dot ${color}`} />
        <span>{email ?? (color === 'w' ? 'White seat open' : 'Black seat open')}</span>
        {isTurn && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>· to move</span>}
      </span>
      {clockMs != null && (
        <span
          className="mono"
          style={{
            fontSize: 18,
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: 6,
            fontVariantNumeric: 'tabular-nums',
            background: clockRunning ? 'var(--gold-soft)' : 'var(--panel-alt)',
            color: clockLow ? 'var(--red)' : clockRunning ? '#1c1c1c' : 'var(--text)'
          }}
        >
          {formatClock(clockMs)}
        </span>
      )}
    </div>
  );
}

export function GamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const chess = useRef(new Chess());
  const socket = useRef<GameSocket | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [game, setGame] = useState<Game | null>(null);
  const [fen, setFen] = useState(chess.current.fen());
  const [moves, setMoves] = useState<string[]>([]);
  const [over, setOver] = useState<OverPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState(440);
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [soundOn, setSoundOnState] = useState(isSoundOn());
  const [promo, setPromo] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);
  const [showResult, setShowResult] = useState(true);
  const prevMoveCount = useRef(0);
  const primed = useRef(false);

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? 440;
      setBoardWidth(Math.max(260, Math.min(w, 520)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  function applyGame(g: Game) {
    setGame(g);
    const c = new Chess();
    if (g.pgn && g.pgn.trim()) c.loadPgn(g.pgn);
    chess.current = c;
    const history = c.history();
    setFen(c.fen());
    setMoves(history);
    // A full state sync (load / reconnect / join) is not a "move" — don't chime.
    prevMoveCount.current = history.length;
    setSelected(null);
    if (g.status === 'FINISHED' && g.result) {
      setOver({ result: g.result, reason: g.resultReason ?? '' });
    }
  }

  useEffect(() => {
    let live: GameSocket | null = null;
    (async () => {
      try {
        applyGame(await gamesApi.get(id));
        primed.current = true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load this game.');
        return;
      }
      live = connectGameSocket(id, {
        onState: (g) => applyGame(g),
        onMove: (p) => {
          const c = new Chess();
          if (p.pgn && p.pgn.trim()) c.loadPgn(p.pgn);
          chess.current = c;
          setFen(p.fen);
          setMoves(c.history());
          setGame((prev) =>
            prev
              ? {
                  ...prev,
                  status: p.status,
                  ...(p.clock
                    ? {
                        whiteMs: p.clock.whiteMs,
                        blackMs: p.clock.blackMs,
                        clockUpdatedAt: p.clock.updatedAt
                      }
                    : {})
                }
              : prev
          );
        },
        onOver: (p) => {
          setOver(p);
          setShowResult(true);
          playGameOverSound();
        },
        onError: (p) => {
          setError(p.message);
          gamesApi.get(id).then(applyGame).catch(() => undefined);
        }
      });
      socket.current = live;
    })();
    return () => live?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Chime on every new half-move (mine or the opponent's). A full state sync
  // resets prevMoveCount in applyGame, so reconnects stay silent.
  useEffect(() => {
    if (primed.current && moves.length > prevMoveCount.current) {
      playMoveSound(soundForSan(moves[moves.length - 1] ?? ''));
    }
    prevMoveCount.current = moves.length;
  }, [moves]);

  // Re-render ~4x/s to animate a running clock down.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (game?.status !== 'ACTIVE' || game.initialSeconds == null) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, [game?.status, game?.initialSeconds]);

  async function joinGame() {
    if (!game) return;
    setJoining(true);
    setError(null);
    try {
      await gamesApi.join(game.id);
      applyGame(await gamesApi.get(game.id));
      // Re-announce in the room so the creator gets a fresh game:state.
      socket.current?.rejoin();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join this game.');
    } finally {
      setJoining(false);
    }
  }

  async function cancelChallenge() {
    if (!game) return;
    setCancelling(true);
    setError(null);
    try {
      // The REST layer broadcasts the ABANDONED game:state to the room, so
      // any viewer of the shared link updates without us emitting anything.
      await gamesApi.cancel(game.id);
      navigate('/app/play');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel this challenge.');
      setCancelling(false);
    }
  }

  const myColor: 'white' | 'black' | null = !game
    ? null
    : game.whiteId === user?.id
      ? 'white'
      : game.blackId === user?.id
        ? 'black'
        : null;
  const myTurnChar = myColor === 'white' ? 'w' : 'b';
  const turn = chess.current.turn();
  const isMyTurn = !!myColor && game?.status === 'ACTIVE' && turn === myTurnChar && !over;

  const squareStyles = useMemo(() => {
    const verbose = chess.current.history({ verbose: true }) as unknown as { from: string; to: string }[];
    const last = verbose[verbose.length - 1];
    return mergeStyles(
      last ? lastMoveStyles(last.from, last.to) : {},
      checkStyles(fen),
      selected ? moveHintStyles(fen, selected) : {}
    );
  }, [fen, moves, selected]);

  function tryMove(from: string, to: string, promotion?: PromotionChoice): boolean {
    if (!socket.current || !isMyTurn) return false;
    let mv;
    try {
      mv = chess.current.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return false;
    }
    if (!mv) return false;
    setFen(chess.current.fen());
    setMoves(chess.current.history());
    setSelected(null);
    setPromo(null);
    socket.current.move({ from, to, promotion: promotion ?? 'q' });
    return true;
  }

  function onDrop(from: string, to: string): boolean {
    if (!isMyTurn) return false;
    if (isPromotionMove(fen, from, to)) {
      setPromo({ from, to, color: myTurnChar });
      setSelected(null);
      return false;
    }
    return tryMove(from, to);
  }

  function onSquareClick(square: string) {
    if (!isMyTurn) {
      setSelected(null);
      return;
    }
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (isLegalTarget(fen, selected, square)) {
        if (isPromotionMove(fen, selected, square)) {
          setPromo({ from: selected, to: square, color: myTurnChar });
          setSelected(null);
        } else {
          tryMove(selected, square);
        }
        return;
      }
    }
    const piece = chess.current.get(square as never) as { color: 'w' | 'b' } | null;
    setSelected(piece && piece.color === myTurnChar ? square : null);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundOnState(next);
    if (next) playMoveSound('move');
  }

  if (error && !game) {
    return (
      <Panel title="Game unavailable">
        <p className="pl-hint">{error}</p>
        <Link to="/app/play" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>
          ← Back to lobby
        </Link>
      </Panel>
    );
  }

  if (!game) return <div className="page-sub">Loading game…</div>;

  const topColor: 'w' | 'b' = myColor === 'black' ? 'w' : 'b';
  const topEmail = topColor === 'w' ? game.white?.email ?? null : game.black?.email ?? null;
  const bottomEmail = topColor === 'w' ? game.black?.email ?? null : game.white?.email ?? null;
  const bottomColor: 'w' | 'b' = topColor === 'w' ? 'b' : 'w';

  const clk = liveClock(game);
  const msFor = (c: 'w' | 'b') => (c === 'w' ? clk.whiteMs : clk.blackMs);
  const isLow = (ms: number | null) => ms != null && ms <= 20_000;

  const bannerClass = over
    ? over.result === 'DRAW'
      ? ''
      : (over.result === 'WHITE_WINS') === (myColor === 'white')
        ? 'win'
        : 'lose'
    : '';

  // Canonical, shareable URL for this game (independent of any hash/query).
  const inviteUrl = `${window.location.origin}/app/play/${game.id}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Game</div>
          <div className="page-sub">
            <Link to="/app/play" style={{ color: 'var(--gold-soft)' }}>
              ← Lobby
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title={soundOn ? 'Mute move sounds' : 'Unmute move sounds'}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <CopyLinkButton value={inviteUrl} label="Copy game link" className="btn btn-ghost btn-sm" />
        </div>
      </div>

      <div className="pl-game">
        <div>
          <Seat
            email={topEmail}
            color={topColor}
            isTurn={game.status === 'ACTIVE' && !over && turn === topColor}
            clockMs={msFor(topColor)}
            clockRunning={clk.running === topColor && !over}
            clockLow={isLow(msFor(topColor))}
          />
          <div className="pl-board-wrap" ref={wrapRef} style={{ position: 'relative' }}>
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              onPieceDragBegin={(_piece: string, sq: string) => {
                if (isMyTurn) setSelected(sq);
              }}
              onPromotionCheck={() => false}
              boardOrientation={myColor ?? 'white'}
              boardWidth={boardWidth}
              arePiecesDraggable={isMyTurn}
              showBoardNotation
              customSquareStyles={squareStyles}
              customBoardStyle={{ borderRadius: 8 }}
              customDarkSquareStyle={{ backgroundColor: '#6b7f63' }}
              customLightSquareStyle={{ backgroundColor: '#e9e6d8' }}
              customNotationStyle={{ fontSize: '10px', fontWeight: 600 }}
            />
            {promo && (
              <PromotionPicker
                color={promo.color}
                onPick={(choice) => tryMove(promo.from, promo.to, choice)}
                onCancel={() => setPromo(null)}
              />
            )}
          </div>
          <Seat
            email={bottomEmail}
            color={bottomColor}
            isTurn={game.status === 'ACTIVE' && !over && turn === bottomColor}
            clockMs={msFor(bottomColor)}
            clockRunning={clk.running === bottomColor && !over}
            clockLow={isLow(msFor(bottomColor))}
          />
        </div>

        <div className="pl-side">
          {game.status === 'PENDING' && myColor && (
            <div className="pl-banner">
              <b>Waiting for an opponent.</b>
              <div style={{ marginTop: 6 }} className="pl-hint">
                Send this link to whoever you want to play — they open it and the game starts. It also
                shows in the lobby for anyone online to join.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    maxWidth: '100%',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {inviteUrl}
                </code>
                <CopyLinkButton value={inviteUrl} />
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--red)' }}
                  onClick={cancelChallenge}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling…' : 'Cancel challenge'}
                </button>
              </div>
            </div>
          )}

          {game.status === 'ABANDONED' && (
            <div className="pl-banner">
              <b>This challenge is no longer available.</b>
              <div style={{ marginTop: 6 }}>
                <Link to="/app/play" className="btn btn-ghost btn-sm">
                  ← Back to lobby
                </Link>
              </div>
            </div>
          )}

          {game.status === 'PENDING' && !myColor && (
            <div className="pl-banner">
              <b>This game is open.</b>
              <div style={{ marginTop: 6 }} className="pl-hint">
                {(game.white ?? game.black)?.email ?? 'A member'} is waiting for an opponent. Join to
                take the {game.whiteId ? 'black' : 'white'} pieces.
              </div>
              <button
                className="btn btn-gold btn-sm"
                style={{ marginTop: 10 }}
                onClick={joinGame}
                disabled={joining}
              >
                {joining ? 'Joining…' : 'Join game'}
              </button>
            </div>
          )}

          {over && (
            <div className={`pl-banner ${bannerClass}`}>
              <b>{resultText(over.result, over.reason)}</b>
            </div>
          )}

          {error && game && <div className="pl-hint" style={{ color: '#E88376' }}>{error}</div>}

          <Panel title="Moves">
            {moves.length === 0 ? (
              <div className="pl-hint">No moves yet.</div>
            ) : (
              <div className="pl-movelist">
                {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => (
                  <span key={i}>
                    <span className="num">{i + 1}.</span>
                    <span className="mv">{moves[i * 2]}</span>
                    <span className="mv">{moves[i * 2 + 1] ?? ''}</span>{' '}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          {myColor && game.status === 'ACTIVE' && !over && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--red)', alignSelf: 'flex-start' }}
              onClick={() => socket.current?.resign()}
            >
              Resign
            </button>
          )}
        </div>
      </div>

      {over && showResult && (
        <GameOverModal
          result={over.result}
          reason={over.reason}
          myColor={myColor}
          pgn={game.pgn}
          onClose={() => setShowResult(false)}
        />
      )}
    </>
  );
}
