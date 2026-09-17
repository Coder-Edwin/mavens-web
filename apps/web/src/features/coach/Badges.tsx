import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { badgesApi, type Badge, type BadgeInput, type StudentBadge } from '@/lib/badges';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { inputStyle, labelStyle, mutedNote } from '@/features/admin/crmStyles';

const EMPTY: BadgeInput = { name: '', icon: '🏆', criteria: '' };

export function Badges() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [catalog, setCatalog] = useState<Badge[] | null>(null);
  const [roster, setRoster] = useState<StudentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<BadgeInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [badgeId, setBadgeId] = useState('');
  const [earned, setEarned] = useState<StudentBadge[] | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [awardMessage, setAwardMessage] = useState<string | null>(null);

  async function refreshCatalog() {
    try {
      const data = await badgesApi.list();
      setCatalog(data);
      setBadgeId((prev) => prev || data[0]?.id || '');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load badges.');
    }
  }

  useEffect(() => {
    refreshCatalog();
    studentsApi
      .list('own')
      .then((rows) => {
        setRoster(rows);
        setStudentId((prev) => prev || rows[0]?.id || '');
      })
      .catch(() => undefined);
  }, []);

  async function refreshEarned(forId: string) {
    if (!forId) return;
    try {
      setEarned(await badgesApi.forStudent(forId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this student's badges.");
    }
  }

  useEffect(() => {
    setEarned(null);
    refreshEarned(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function createBadge(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await badgesApi.create({
        name: form.name.trim(),
        icon: form.icon.trim(),
        criteria: form.criteria?.trim() || undefined
      });
      setForm(EMPTY);
      setShowNew(false);
      await refreshCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this badge.');
    } finally {
      setSaving(false);
    }
  }

  async function award(e: FormEvent) {
    e.preventDefault();
    if (!studentId || !badgeId) return;
    setAwarding(true);
    setAwardMessage(null);
    setError(null);
    try {
      await badgesApi.award(studentId, badgeId);
      setAwardMessage('Awarded!');
      await refreshEarned(studentId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not award this badge.');
    } finally {
      setAwarding(false);
    }
  }

  async function revoke(bId: string) {
    if (!window.confirm('Remove this badge from the student?')) return;
    setError(null);
    try {
      await badgesApi.revoke(bId, studentId);
      await refreshEarned(studentId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this badge.');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Badges</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {isAdmin && !showNew && <Button onClick={() => setShowNew(true)}>New badge</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {showNew && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="New badge">
            <form onSubmit={createBadge}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="bg-icon">
                    Icon <span style={{ opacity: 0.6 }}>— an emoji</span>
                  </label>
                  <input
                    id="bg-icon"
                    style={inputStyle}
                    value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 3 }}>
                  <label style={labelStyle} htmlFor="bg-name">
                    Name
                  </label>
                  <input
                    id="bg-name"
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <label style={labelStyle} htmlFor="bg-criteria">
                Criteria <span style={{ opacity: 0.6 }}>— optional, what earns it (read by whoever awards it)</span>
              </label>
              <textarea
                id="bg-criteria"
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={form.criteria}
                onChange={(e) => setForm((f) => ({ ...f, criteria: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : 'Create badge'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Panel title="Badge catalog">
          {!catalog ? (
            <div style={mutedNote}>Loading…</div>
          ) : catalog.length === 0 ? (
            <div style={mutedNote}>No badges defined yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {catalog.map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                  <span style={{ fontSize: 22 }}>{b.icon}</span>
                  <div>
                    <b>{b.name}</b>
                    {b.criteria && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.criteria}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Award a badge">
          {roster.length === 0 ? (
            <div style={mutedNote}>You have no students assigned to you yet.</div>
          ) : (
            <>
              <label style={labelStyle} htmlFor="bg-student">
                Student
              </label>
              <select
                id="bg-student"
                style={inputStyle}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                {roster.map((s) => (
                  <option key={s.id} value={s.id}>
                    {studentName(s)}
                  </option>
                ))}
              </select>

              <div style={{ marginBottom: 14 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>Earned so far</div>
                {!earned ? (
                  <div style={mutedNote}>Loading…</div>
                ) : earned.length === 0 ? (
                  <div style={mutedNote}>No badges yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {earned.map((e) => (
                      <span
                        key={e.badgeId}
                        title={e.badge.criteria ?? undefined}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 20,
                          background: 'var(--panel-alt)',
                          border: '1px solid var(--line)',
                          fontSize: 12
                        }}
                      >
                        {e.badge.icon} {e.badge.name}
                        {isAdmin && (
                          <button
                            aria-label={`Remove ${e.badge.name}`}
                            onClick={() => revoke(e.badgeId)}
                            style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', padding: 0 }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {catalog && catalog.length > 0 && (
                <form onSubmit={award} style={{ display: 'flex', gap: 8 }}>
                  <select
                    aria-label="Badge to award"
                    style={{ ...inputStyle, margin: 0, flex: 1 }}
                    value={badgeId}
                    onChange={(e) => setBadgeId(e.target.value)}
                  >
                    {catalog.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.icon} {b.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-gold btn-sm" type="submit" disabled={awarding}>
                    {awarding ? 'Awarding…' : 'Award'}
                  </button>
                </form>
              )}
              {awardMessage && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold-soft)' }}>{awardMessage}</div>
              )}
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
