import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Panel } from '@/components/ui/Primitives';
import { CopyLinkButton } from '@/features/play/CopyLinkButton';
import { PromotionPicker, type PromotionChoice } from '@/features/play/PromotionPicker';
import { JitsiEmbed } from '@/features/classroom/JitsiEmbed';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  checkStyles,
  isLegalTarget,
  isPromotionMove,
  lastMoveStyles,
  mergeStyles,
  moveHintStyles,
  sideToMove as sideOf
} from '@/lib/chess-hints';
import { isSoundOn, playMoveSound, setSoundOn, soundForSan } from '@/lib/chess-sound';
import {
  classroomApi,
  connectClassroomSocket,
  jitsiRoomName,
  type ClassroomParticipant,
  type ClassroomRoom,
  type ClassroomSocket
} from '@/lib/classroom';

export function ClassroomRoomPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const chess = useRef(new Chess());
  const socket = useRef<ClassroomSocket | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [room, setRoom] = useState<ClassroomRoom | null>(null);
  const [fen, setFen] = useState(chess.current.fen());
  const [participants, setParticipants] = useState<ClassroomParticipant[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);
  const [soundOn, setSoundOnState] = useState(isSoundOn());
  const [loadText, setLoadText] = useState('');
  const [loadLabel, setLoadLabel] = useState('');
  const [closed, setClosed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState(420);
  const [loadNotFound, setLoadNotFound] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? 420;
      setBoardWidth(Math.max(260, Math.min(w, 480)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  function applyRoom(r: ClassroomRoom) {
    setRoom(r);
    const c = new Chess();
    if (r.pgn && r.pgn.trim()) c.loadPgn(r.pgn);
    chess.current = c;
    setFen(r.fen);
    setSelected(null);
  }

  useEffect(() => {
    let live: ClassroomSocket | null = null;
    (async () => {
      try {
        applyRoom(await classroomApi.get(id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load this classroom.');
        setLoadNotFound(true);
        return;
      }
      live = connectClassroomSocket(id, user?.email ?? 'Guest', {
        onState: (payload) => {
          applyRoom(payload.room);
          if (payload.move) playMoveSound(soundForSan(payload.move.san));
          if (payload.loadedEntry) setNote(`Loaded "${payload.loadedEntry.label}".`);
        },
        onParticipants: setParticipants,
        onClosed: () => setClosed(true),
        onError: (p) => {
          setError(p.message);
          // The state that caused this rejection was never broadcast — pull
          // the authoritative room fresh so a failed local guess self-heals.
          classroomApi.get(id).then(applyRoom).catch(() => undefined);
        }
      });
      socket.current = live;
    })();
    return () => live?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const squareStyles = useMemo(() => {
    const verbose = chess.current.history({ verbose: true }) as unknown as { from: string; to: string }[];
    const last = verbose[verbose.length - 1];
    return mergeStyles(
      last ? lastMoveStyles(last.from, last.to) : {},
      checkStyles(fen),
      selected ? moveHintStyles(fen, selected) : {}
    );
  }, [fen, selected]);

  const isOpen = room?.status === 'OPEN' && !closed;
  const isHost = !!room && !!user && room.hostUserId === user.id;

  function tryMove(from: string, to: string, promotion?: PromotionChoice): boolean {
    if (!socket.current || !isOpen) return false;
    let mv;
    try {
      mv = chess.current.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return false;
    }
    if (!mv) return false;
    setFen(chess.current.fen());
    setSelected(null);
    setPromo(null);
    socket.current.move({ from, to, promotion: promotion ?? 'q' });
    return true;
  }

  function onDrop(from: string, to: string): boolean {
    if (!isOpen) return false;
    if (isPromotionMove(fen, from, to)) {
      setPromo({ from, to, color: sideOf(fen) });
      setSelected(null);
      return false;
    }
    return tryMove(from, to);
  }

  function onSquareClick(square: string) {
    if (!isOpen) return;
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (isLegalTarget(fen, selected, square)) {
        if (isPromotionMove(fen, selected, square)) {
          setPromo({ from: selected, to: square, color: sideOf(fen) });
          setSelected(null);
        } else {
          tryMove(selected, square);
        }
        return;
      }
    }
    const piece = chess.current.get(square as never) as { color: 'w' | 'b' } | null;
    setSelected(piece && piece.color === sideOf(fen) ? square : null);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundOnState(next);
    if (next) playMoveSound('move');
  }

  function loadPosition() {
    const text = loadText.trim();
    if (!text || !socket.current) return;
    setError(null);
    setNote(null);
    const label = loadLabel.trim() || undefined;
    // Same PGN-vs-FEN sniff as the Analysis board's loader.
    if (/\d\.\s|\[|1-0|0-1|1\/2-1\/2|\*/.test(text)) {
      socket.current.loadPosition({ pgn: text, label });
    } else {
      socket.current.loadPosition({ fen: text, label });
    }
    setLoadText('');
    setLoadLabel('');
  }

  async function removeEntry(entryId: string) {
    try {
      await classroomApi.removeFromLibrary(id, entryId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that game.');
    }
  }

  async function closeRoom() {
    if (!window.confirm('Close this classroom for everyone?')) return;
    setClosing(true);
    try {
      await classroomApi.close(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not close the classroom.');
    } finally {
      setClosing(false);
    }
  }

  if (loadNotFound) {
    return (
      <Panel title="Classroom unavailable">
        <p className="pl-hint">{error}</p>
        <Link to="/app/classroom" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>
          ← Back to Classroom
        </Link>
      </Panel>
    );
  }

  if (!room) return <div className="page-sub">Loading classroom…</div>;

  const joinUrl = `${window.location.origin}/app/classroom/${room.id}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{room.title || 'Classroom'}</div>
          <div className="page-sub">
            <Link to="/app/classroom" style={{ color: 'var(--gold-soft)' }}>
              ← Classroom
            </Link>{' '}
            · code <span className="mono">{room.code}</span>
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
          <CopyLinkButton value={joinUrl} label="Copy join link" className="btn btn-ghost btn-sm" />
          {isHost && isOpen && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={closeRoom} disabled={closing}>
              {closing ? 'Closing…' : 'Close room'}
            </button>
          )}
        </div>
      </div>

      {closed && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>This classroom has been closed.</b>
        </div>
      )}
      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <Chessboard
            position={fen}
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            onPieceDragBegin={(_piece: string, sq: string) => isOpen && setSelected(sq)}
            onPromotionCheck={() => false}
            arePiecesDraggable={isOpen}
            boardWidth={boardWidth}
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
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={!isOpen}
              onClick={() => socket.current?.reset()}
            >
              Reset board
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Video">
            <div style={{ height: 260 }}>
              <JitsiEmbed roomName={jitsiRoomName(room.code)} displayName={user?.email ?? 'Guest'} />
            </div>
          </Panel>

          <Panel title={`In this room (${participants.length})`}>
            {participants.length === 0 ? (
              <div className="pl-hint">Just you so far — share the join link or code above.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {participants.map((p, i) => (
                  <li key={`${p.userId}-${i}`}>{p.name}</li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Library">
            {(room.library ?? []).length === 0 ? (
              <div className="pl-hint">No games loaded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {room.library.map((entry) => (
                  <div
                    key={entry.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
                  >
                    <span>{entry.label}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={!isOpen}
                        onClick={() => socket.current?.selectFromLibrary(entry.id)}
                      >
                        Use
                      </button>
                      {isHost && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--red)' }}
                          onClick={() => removeEntry(entry.id)}
                        >
                          Remove
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <label
              htmlFor="cr-load-label"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}
            >
              Label (optional)
            </label>
            <input
              id="cr-load-label"
              value={loadLabel}
              onChange={(e) => setLoadLabel(e.target.value)}
              placeholder="e.g. Rook endgame"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 9px',
                borderRadius: 6,
                border: '1px solid var(--line)',
                background: 'var(--panel-alt)',
                color: 'var(--text)',
                fontSize: 12,
                margin: '4px 0 8px'
              }}
            />
            <textarea
              value={loadText}
              onChange={(e) => setLoadText(e.target.value)}
              placeholder="Paste a FEN or PGN to load several games at once…"
              style={{
                width: '100%',
                minHeight: 70,
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
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-gold btn-sm" onClick={loadPosition} disabled={!isOpen || !loadText.trim()}>
                Load
              </button>
            </div>
            {note && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold-soft)' }}>{note}</div>}
          </Panel>
        </div>
      </div>
    </>
  );
}
