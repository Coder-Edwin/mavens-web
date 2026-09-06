import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Panel } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  connectGameSocket,
  gamesApi,
  resultText,
  type Game,
  type GameSocket,
  type OverPayload
} from '@/lib/games';
import '@/styles/play.css';

function Seat({ email, color, isTurn }: { email: string | null; color: 'w' | 'b'; isTurn: boolean }) {
  return (
    <div className={`pl-seat${isTurn ? ' turn' : ''}`}>
      <span className={`dot ${color}`} />
      <span>{email ?? (color === 'w' ? 'White seat open' : 'Black seat open')}</span>
      {isTurn && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>· to move</span>}
    </div>
  );
}

export function GamePage() {
  const { id = '' } = useParams();
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
    setFen(c.fen());
    setMoves(c.history());
    if (g.status === 'FINISHED' && g.result) {
      setOver({ result: g.result, reason: g.resultReason ?? '' });
    }
  }

  useEffect(() => {
    let live: GameSocket | null = null;
    (async () => {
      try {
        applyGame(await gamesApi.get(id));
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
          setGame((prev) => (prev ? { ...prev, status: p.status } : prev));
        },
        onOver: (p) => setOver(p),
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

  function onDrop(from: string, to: string): boolean {
    if (!socket.current || !isMyTurn) return false;
    let mv;
    try {
      mv = chess.current.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!mv) return false;
    setFen(chess.current.fen());
    setMoves(chess.current.history());
    socket.current.move({ from, to, promotion: 'q' });
    return true;
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

  const bannerClass = over
    ? over.result === 'DRAW'
      ? ''
      : (over.result === 'WHITE_WINS') === (myColor === 'white')
        ? 'win'
        : 'lose'
    : '';

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
      </div>

      <div className="pl-game">
        <div>
          <Seat email={topEmail} color={topColor} isTurn={game.status === 'ACTIVE' && !over && turn === topColor} />
          <div className="pl-board-wrap" ref={wrapRef}>
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={myColor ?? 'white'}
              boardWidth={boardWidth}
              arePiecesDraggable={isMyTurn}
              customBoardStyle={{ borderRadius: 8 }}
            />
          </div>
          <Seat
            email={bottomEmail}
            color={bottomColor}
            isTurn={game.status === 'ACTIVE' && !over && turn === bottomColor}
          />
        </div>

        <div className="pl-side">
          {game.status === 'PENDING' && (
            <div className="pl-banner">
              Waiting for an opponent to join. Share this page’s link to invite someone.
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
    </>
  );
}
