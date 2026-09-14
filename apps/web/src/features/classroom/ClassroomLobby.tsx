import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { classroomApi } from '@/lib/classroom';

const FEATURES = [
  { glyph: '🎥', text: 'Voice and video with everyone in the room' },
  { glyph: '♟', text: 'Load several games or positions and switch between them' },
  { glyph: '🛠', text: 'Room management tools for coaching' }
];

export function ClassroomLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canHost = user?.role === 'ADMIN' || user?.role === 'COACH' || !!user?.isCoach;

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startRoom() {
    setStarting(true);
    setError(null);
    try {
      const room = await classroomApi.create(title.trim() || undefined);
      navigate(`/app/classroom/${room.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start a classroom.');
      setStarting(false);
    }
  }

  async function joinRoom(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoining(true);
    setError(null);
    try {
      const room = await classroomApi.getByCode(trimmed);
      navigate(`/app/classroom/${room.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No classroom with that code.');
      setJoining(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Classroom</div>
          <div className="page-sub">
            The best way to share a chess board with a coach, student, or friend
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        {FEATURES.map((f) => (
          <div
            key={f.text}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--muted)',
              flex: '1 1 220px'
            }}
          >
            <span style={{ fontSize: 18 }}>{f.glyph}</span>
            {f.text}
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Panel title="New room">
          {canHost ? (
            <>
              <label
                htmlFor="cr-title"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}
              >
                Title (optional)
              </label>
              <input
                id="cr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Saturday Novices — Endgames"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 11px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--panel-alt)',
                  color: 'var(--text)',
                  fontSize: 13,
                  margin: '6px 0 12px'
                }}
              />
              <Button onClick={startRoom} disabled={starting}>
                {starting ? 'Starting…' : '+ New room'}
              </Button>
            </>
          ) : (
            <p className="pl-hint">Ask your coach to start a classroom — you can join with the room code.</p>
          )}
        </Panel>

        <Panel title="Join room">
          <form onSubmit={joinRoom} style={{ display: 'flex', gap: 8 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              aria-label="Room code"
              style={{
                flex: 1,
                boxSizing: 'border-box',
                padding: '9px 11px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--panel-alt)',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}
            />
            <button className="btn btn-gold btn-sm" type="submit" disabled={joining || !code.trim()}>
              {joining ? 'Joining…' : 'Join →'}
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}
