import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '@/components/ui/Primitives';
import { SessionAgenda } from '@/components/SessionAgenda';
import { ApiError } from '@/lib/api-client';
import { api } from '@/lib/api-client';
import { studentsApi, type StudentRecord } from '@/lib/students';
import { inputStyle } from '@/features/admin/crmStyles';

/// A free-form, un-scheduled session (no ClassSchedule behind it) logged
/// on the spot — the coach-side counterpart to the SCHEDULED sessions an
/// admin generates from a ClassSchedule, both of which show up below.
function LogSessionPanel({ onLogged }: { onLogged: () => void }) {
  const [roster, setRoster] = useState<StudentRecord[]>([]);
  const [topic, setTopic] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentsApi.list('own').then(setRoster).catch(() => undefined);
  }, []);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/sessions', {
        topic,
        date: new Date().toISOString().slice(0, 10),
        presentStudentIds: selectedIds
      });
      setTopic('');
      setSelectedIds([]);
      setSuccess('Session logged.');
      onLogged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log this session.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Log a session">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="What did you cover? e.g. Rook endgames"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', marginBottom: 8 }}>
          WHO ATTENDED?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {roster.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
              No students are assigned to you yet.
            </div>
          )}
          {roster.map((s) => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggle(s.id)} />
              {s.firstName} {s.lastName}
            </label>
          ))}
        </div>
        <button className="btn btn-gold" disabled={submitting || !topic.trim() || selectedIds.length === 0}>
          {submitting ? 'Logging…' : 'Log session'}
        </button>
        {error && <div style={{ marginTop: 10, fontSize: 11.5, color: '#E88376' }}>{error}</div>}
        {success && <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--leaf)' }}>{success}</div>}
      </form>
    </Panel>
  );
}

export function TodaysSessions() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Today's Sessions</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <LogSessionPanel onLogged={() => setRefreshKey((k) => k + 1)} />
      </div>

      <SessionAgenda key={refreshKey} scope="own" title="My week" />
    </>
  );
}
