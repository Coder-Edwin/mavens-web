import { useEffect, useState } from 'react';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  tournamentsApi,
  formatTournamentDate,
  type MyTournamentRegistration,
  type StandingRow,
  type TournamentSummary
} from '@/lib/tournaments';

function money(v: string): string {
  return `KES ${Number(v).toLocaleString()}`;
}

export function StudentTournaments() {
  const [tournaments, setTournaments] = useState<TournamentSummary[] | null>(null);
  const [myRegs, setMyRegs] = useState<MyTournamentRegistration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [standings, setStandings] = useState<Record<string, StandingRow[]>>({});

  async function refresh() {
    try {
      const [t, mine] = await Promise.all([tournamentsApi.list(), tournamentsApi.mine()]);
      setTournaments(t);
      setMyRegs(mine);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tournaments.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const registeredIds = new Set((myRegs ?? []).map((r) => r.tournament.id));

  async function register(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await tournamentsApi.registerSelf(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register for this tournament.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStandings(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!standings[id]) {
      try {
        const rows = await tournamentsApi.standings(id);
        setStandings((s) => ({ ...s, [id]: rows }));
      } catch {
        setError('Could not load standings for this tournament.');
      }
    }
  }

  if (!tournaments || !myRegs) return <div className="page-sub">Loading tournaments…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Tournaments</div>
          <div className="page-sub">Club rapids, the schools league, and open events</div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {tournaments.length === 0 ? (
        <Panel title="No tournaments yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            Nothing scheduled right now — check back soon.
          </p>
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tournaments.map((t) => {
            const isRegistered = registeredIds.has(t.id);
            const deadlinePassed = !!t.registrationDeadline && new Date() > new Date(t.registrationDeadline);
            const canRegister = !isRegistered && !t.isFull && !deadlinePassed;
            const myRow = standings[t.id]?.find((row) =>
              myRegs.some((r) => r.tournament.id === t.id && r.id === row.registrationId)
            );

            return (
              <Panel key={t.id} title={t.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {formatTournamentDate(t.date)} · {t.venue} · {money(t.feeAmount)}
                    <div style={{ marginTop: 4 }}>
                      {t.registeredCount} registered{t.capacity ? ` / ${t.capacity} spots` : ''}
                      {t.registrationDeadline &&
                        ` · registration ${deadlinePassed ? 'closed' : `closes ${formatTournamentDate(t.registrationDeadline)}`}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isRegistered && <Chip status="paid" label="Registered" />}
                    {!isRegistered && t.isFull && <Chip status="overdue" label="Full" />}
                    {!isRegistered && !t.isFull && deadlinePassed && <Chip status="pending" label="Registration closed" />}
                    {canRegister && (
                      <button className="btn btn-gold btn-sm" disabled={busyId === t.id} onClick={() => register(t.id)}>
                        {busyId === t.id ? 'Registering…' : 'Register'}
                      </button>
                    )}
                    {isRegistered && (
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleStandings(t.id)}>
                        {openId === t.id ? 'Hide standings' : 'Standings'}
                      </button>
                    )}
                  </div>
                </div>

                {openId === t.id && (
                  <div style={{ marginTop: 14 }}>
                    {!standings[t.id] ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
                    ) : standings[t.id].length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>No rounds paired yet.</div>
                    ) : (
                      <>
                        {myRow && (
                          <div className="mono" style={{ fontSize: 12, marginBottom: 8, color: 'var(--gold-soft)' }}>
                            You're ranked #{myRow.rank} with {myRow.score} points ({myRow.wins}W {myRow.draws}D{' '}
                            {myRow.losses}L).
                          </div>
                        )}
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Player</th>
                              <th>Score</th>
                              <th>Buchholz</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings[t.id].map((row) => (
                              <tr
                                key={row.registrationId}
                                style={row.registrationId === myRow?.registrationId ? { fontWeight: 700 } : undefined}
                              >
                                <td>{row.rank}</td>
                                <td>{row.name}</td>
                                <td className="mono">{row.score}</td>
                                <td className="mono">{row.buchholz}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
