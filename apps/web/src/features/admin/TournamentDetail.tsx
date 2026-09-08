import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  tournamentsApi,
  formatTournamentDate,
  RESULT_LABEL,
  type Pairing,
  type StandingRow,
  type Tournament,
  type TournamentRound
} from '@/lib/tournaments';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { mutedNote, labelStyle } from './crmStyles';

function playerName(ref: { student: { firstName: string; lastName: string } } | null): string {
  return ref ? `${ref.student.firstName} ${ref.student.lastName}` : 'BYE';
}

export function TournamentDetail() {
  const { id = '' } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addStudentId, setAddStudentId] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, r, s] = await Promise.all([
        tournamentsApi.get(id),
        tournamentsApi.rounds(id),
        tournamentsApi.standings(id)
      ]);
      setTournament(t);
      setRounds(r);
      setStandings(s);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the tournament.');
    }
  }, [id]);

  useEffect(() => {
    load();
    studentsApi
      .list()
      .then(setStudents)
      .catch(() => {
        /* picker stays empty */
      });
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !tournament) {
    return (
      <div className="panel" style={{ borderColor: 'var(--red)' }}>
        <div className="panel-title">Something went wrong</div>
        <p style={mutedNote}>{error}</p>
        <Link to="/app/tournaments" style={{ color: 'var(--gold-soft)' }}>
          ← Tournaments
        </Link>
      </div>
    );
  }
  if (!tournament) return <div className="page-sub">Loading tournament…</div>;

  const activeCount = tournament.registrations.filter((r) => !r.withdrawn).length;
  const lastRound = rounds[rounds.length - 1];
  const canPair =
    (!lastRound || lastRound.status === 'COMPLETED') &&
    (!tournament.totalRounds || rounds.length < tournament.totalRounds) &&
    activeCount >= 2;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{tournament.name}</div>
          <div className="page-sub">
            <Link to="/app/tournaments" style={{ color: 'var(--gold-soft)' }}>
              ← Tournaments
            </Link>{' '}
            · {formatTournamentDate(tournament.date)} · {tournament.venue} ·{' '}
            {rounds.length}
            {tournament.totalRounds ? `/${tournament.totalRounds}` : ''} rounds
          </div>
        </div>
        <button
          className="btn btn-gold"
          disabled={busy || !canPair}
          onClick={() => run(() => tournamentsApi.pairNextRound(id))}
          title={
            !canPair
              ? lastRound && lastRound.status !== 'COMPLETED'
                ? 'Enter every result for the current round first'
                : 'No more rounds to pair'
              : undefined
          }
        >
          Pair round {rounds.length + 1}
        </button>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      <Panel title="Standings">
        {standings.length === 0 ? (
          <div style={mutedNote}>No games played yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
                <th>Buch.</th>
                <th>W–D–L</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.registrationId} style={{ opacity: r.withdrawn ? 0.5 : 1 }}>
                  <td className="mono">{r.rank}</td>
                  <td style={{ fontSize: 13 }}>
                    {r.name}
                    {r.withdrawn ? ' (withdrawn)' : ''}
                  </td>
                  <td className="mono">{r.score}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {r.buchholz}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {r.wins}–{r.draws}–{r.losses}
                    {r.byes ? ` (+${r.byes} bye)` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {rounds.map((round) => (
        <div key={round.id} style={{ marginTop: 16 }}>
          <Panel title={`Round ${round.number}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Chip
                status={round.status === 'COMPLETED' ? 'paid' : 'pending'}
                label={round.status === 'COMPLETED' ? 'Complete' : 'In progress'}
              />
              {round.id === lastRound?.id && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--red)' }}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete round ${round.number} and its pairings?`))
                      run(() => tournamentsApi.deleteRound(id, round.id));
                  }}
                >
                  Delete round
                </button>
              )}
            </div>
            <table>
              <tbody>
                {round.pairings.map((p: Pairing) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontSize: 12, width: 28 }}>
                      {p.board}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {playerName(p.white)} <span style={{ color: 'var(--muted)' }}>(W)</span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {p.black ? (
                        <>
                          {playerName(p.black)} <span style={{ color: 'var(--muted)' }}>(B)</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>bye</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.result === 'BYE' ? (
                        <span className="mono" style={{ fontSize: 12 }}>
                          {RESULT_LABEL.BYE}
                        </span>
                      ) : (
                        <select
                          aria-label={`Result board ${p.board}`}
                          value={p.result ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            run(() =>
                              tournamentsApi.recordPairingResult(
                                id,
                                p.id,
                                v as 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW'
                              )
                            );
                          }}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            background: 'var(--panel-alt)',
                            color: 'var(--text)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12
                          }}
                        >
                          <option value="">— set —</option>
                          <option value="WHITE_WIN">{RESULT_LABEL.WHITE_WIN} (White wins)</option>
                          <option value="DRAW">{RESULT_LABEL.DRAW} (Draw)</option>
                          <option value="BLACK_WIN">{RESULT_LABEL.BLACK_WIN} (Black wins)</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <Panel title={`Players (${activeCount} active)`}>
          <table>
            <tbody>
              {tournament.registrations.map((r) => (
                <tr key={r.id} style={{ opacity: r.withdrawn ? 0.5 : 1 }}>
                  <td style={{ fontSize: 13 }}>
                    {r.student ? `${r.student.firstName} ${r.student.lastName}` : r.studentId}
                  </td>
                  <td style={{ width: 110 }}>
                    <input
                      aria-label={`Seed for ${r.student?.firstName ?? r.studentId}`}
                      type="number"
                      min={1}
                      placeholder="seed"
                      defaultValue={r.seed ?? ''}
                      disabled={busy}
                      onBlur={(e) => {
                        const v = e.target.value ? Number(e.target.value) : undefined;
                        if (v && v !== r.seed)
                          run(() => tournamentsApi.updateRegistration(id, r.id, { seed: v }));
                      }}
                      style={{
                        width: 80,
                        padding: '5px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: 'var(--panel-alt)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12
                      }}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          tournamentsApi.updateRegistration(id, r.id, { withdrawn: !r.withdrawn })
                        )
                      }
                    >
                      {r.withdrawn ? 'Reinstate' : 'Withdraw'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ ...labelStyle, margin: '12px 0 6px' }}>Add a player</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              aria-label="Student to add"
              value={addStudentId}
              onChange={(e) => setAddStudentId(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 7,
                border: '1px solid var(--line)',
                background: 'var(--panel-alt)',
                color: 'var(--text)',
                fontSize: 13
              }}
            >
              <option value="">Select a student…</option>
              {students
                .filter((s) => !tournament.registrations.some((r) => r.studentId === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {studentName(s)}
                  </option>
                ))}
            </select>
            <button
              className="btn btn-gold btn-sm"
              disabled={busy || !addStudentId}
              onClick={() =>
                run(async () => {
                  await tournamentsApi.register(id, addStudentId);
                  setAddStudentId('');
                })
              }
            >
              Add
            </button>
          </div>
        </Panel>
      </div>
    </>
  );
}
