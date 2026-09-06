import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Panel, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { gamesApi, type ColorPref, type Game } from '@/lib/games';

function opponentOf(game: Game, myId: string | undefined): string {
  const other = game.whiteId === myId ? game.black : game.white;
  return other?.email ?? 'waiting for opponent';
}

export function PlayLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<{ open: Game[]; mine: Game[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<ColorPref>('random');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setData(await gamesApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load games.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function newGame() {
    setBusy(true);
    setError(null);
    try {
      const game = await gamesApi.create(color);
      navigate(`/app/play/${game.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create a game.');
      setBusy(false);
    }
  }

  async function join(id: string) {
    setBusy(true);
    setError(null);
    try {
      await gamesApi.join(id);
      navigate(`/app/play/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join that game.');
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Play</div>
          <div className="page-sub">Live games against other members</div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Panel title="New game">
          <div className="pl-new">
            <label htmlFor="pl-color" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
              Play as
            </label>
            <select
              id="pl-color"
              value={color}
              onChange={(e) => setColor(e.target.value as ColorPref)}
            >
              <option value="random">Random</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
            <Button onClick={newGame} disabled={busy}>
              Create game
            </Button>
            <span className="pl-hint">A challenge link opens once the game is created.</span>
          </div>
        </Panel>
      </div>

      <div className="pl-lobby-grid">
        <Panel title="Your games">
          {!data && <div className="pl-hint">Loading…</div>}
          {data && data.mine.length === 0 && <div className="pl-hint">No games in progress.</div>}
          {data?.mine.map((g) => (
            <div className="pl-row" key={g.id}>
              <div>
                <Link to={`/app/play/${g.id}`} style={{ color: 'var(--text)' }}>
                  vs {opponentOf(g, user?.id)}
                </Link>
                <div className="meta">
                  {g.status === 'PENDING' ? 'waiting for an opponent' : g.status.toLowerCase()}
                </div>
              </div>
              <Link to={`/app/play/${g.id}`} className="btn btn-ghost btn-sm">
                {g.status === 'PENDING' ? 'Open' : 'Resume'}
              </Link>
            </div>
          ))}
        </Panel>

        <Panel title="Open challenges">
          {!data && <div className="pl-hint">Loading…</div>}
          {data && data.open.length === 0 && (
            <div className="pl-hint">No open challenges right now — create one above.</div>
          )}
          {data?.open.map((g) => (
            <div className="pl-row" key={g.id}>
              <div>
                <span>{(g.white ?? g.black)?.email ?? 'A member'}</span>
                <div className="meta">wants {g.whiteId ? 'black' : 'white'}</div>
              </div>
              <button className="btn btn-gold btn-sm" onClick={() => join(g.id)} disabled={busy}>
                Join
              </button>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}
