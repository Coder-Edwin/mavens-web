import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { lichessApi, sortedChannels, type LichessChannelGame } from '@/lib/lichess';

const CHANNEL_LABEL: Record<string, string> = {
  UltraBullet: 'UltraBullet',
  Bullet: 'Bullet',
  Blitz: 'Blitz',
  Rapid: 'Rapid',
  Classical: 'Classical',
  Chess960: 'Chess960',
  Crazyhouse: 'Crazyhouse',
  Atomic: 'Atomic',
  Horde: 'Horde',
  Antichess: 'Antichess',
  KingOfTheHill: 'King of the Hill',
  RacingKings: 'Racing Kings',
  ThreeCheck: 'Three-check'
};

function playerLabel(game: LichessChannelGame): string {
  const name = game.user?.name ?? 'Anonymous';
  const title = game.user?.title ? `${game.user.title} ` : '';
  const rating = game.rating != null ? ` (${game.rating})` : '';
  return `${title}${name}${rating}`;
}

export function LichessFeedPage() {
  const navigate = useNavigate();
  const [tv, setTv] = useState<Awaited<ReturnType<typeof lichessApi.tv>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function refresh() {
    try {
      setTv(await lichessApi.tv());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach lichess right now.');
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 15_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  async function analyse(gameId: string) {
    setLoadingId(gameId);
    setError(null);
    try {
      const { pgn } = await lichessApi.gamePgn(gameId);
      navigate('/app/analysis', { state: { pgn } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load that game.');
    } finally {
      setLoadingId(null);
    }
  }

  const channels = tv ? sortedChannels(tv) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Live from lichess</div>
          <div className="page-sub">
            <Link to="/app/analysis" style={{ color: 'var(--gold-soft)' }}>
              ← Analysis
            </Link>{' '}
            · the current top game per speed &amp; variant, refreshed every 15s
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!tv && !error && <div className="page-sub">Loading…</div>}

      {tv && channels.length === 0 && (
        <Panel title="Nothing live">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            lichess didn&rsquo;t report any games right now — try Refresh in a moment.
          </div>
        </Panel>
      )}

      {channels.length > 0 && (
        <div className="grid-3">
          {channels.map(([channel, game]) => (
            <Panel key={channel} title={CHANNEL_LABEL[channel] ?? channel}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{playerLabel(game)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                playing {game.color === 'black' ? 'Black' : 'White'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a
                  href={`https://lichess.org/${game.gameId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Watch on lichess
                </a>
                <button
                  className="btn btn-gold btn-sm"
                  disabled={loadingId === game.gameId}
                  onClick={() => analyse(game.gameId!)}
                >
                  {loadingId === game.gameId ? 'Loading…' : 'Analyse'}
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
