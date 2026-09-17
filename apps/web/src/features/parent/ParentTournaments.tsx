import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { tournamentsApi, formatTournamentDate, type TournamentSummary } from '@/lib/tournaments';
import { ChildTabs } from '@/features/parent/ChildTabs';
import { useChildren } from '@/features/parent/useChildren';
import { mutedNote } from '@/features/admin/crmStyles';

function money(v: string): string {
  return `KES ${Number(v).toLocaleString()}`;
}

/// The parent "Tournaments" nav item's own destination — register a chosen
/// child for an upcoming tournament, previously only reachable bundled into
/// the Overview page.
export function ParentTournaments() {
  const { children, activeChildId, setActiveChildId, error: childrenError } = useChildren();
  const [tournaments, setTournaments] = useState<TournamentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setTournaments(await tournamentsApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tournaments.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function register(tournamentId: string) {
    if (!activeChildId) return;
    setBusyId(tournamentId);
    setRegisterMessage(null);
    try {
      await tournamentsApi.register(tournamentId, activeChildId);
      setRegisterMessage('Registered!');
      await refresh();
    } catch (err) {
      setRegisterMessage(err instanceof ApiError ? err.message : 'Could not register.');
    } finally {
      setBusyId(null);
    }
  }

  const activeChild = children?.find((c) => c.id === activeChildId) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Tournaments</div>
          <div className="page-sub">Register your child for an upcoming tournament</div>
        </div>
      </div>

      {(error || childrenError) && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error || childrenError}
        </div>
      )}

      {!children || !tournaments ? (
        <div style={mutedNote}>Loading…</div>
      ) : children.length === 0 ? (
        <Panel title="No children linked yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            No students are linked to your account yet. Ask the club admin to link your child's profile to your
            parent account.
          </p>
        </Panel>
      ) : (
        <>
          <ChildTabs children={children} activeChildId={activeChildId} onSelect={setActiveChildId} />

          <div style={{ marginTop: 16 }}>
            <Panel title="Upcoming Tournaments">
              {tournaments.length === 0 && <div style={mutedNote}>No tournaments scheduled right now.</div>}
              {tournaments.map((t) => (
                <div key={t.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 13 }}>
                    <b>{t.name}</b> — {formatTournamentDate(t.date)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {t.venue} · {money(t.feeAmount)} · {t.isFull ? 'FULL' : `${t.registeredCount} registered`}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8 }}
                    disabled={t.isFull || busyId === t.id}
                    onClick={() => register(t.id)}
                  >
                    {t.isFull ? 'Full' : `Register ${activeChild?.firstName ?? ''}`}
                  </button>
                </div>
              ))}
              {registerMessage && (
                <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--gold-soft)' }}>
                  {registerMessage}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
