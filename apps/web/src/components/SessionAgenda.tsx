import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  sessionsApi,
  sessionStatusChip,
  isoDay,
  type SessionRecord
} from '@/lib/sessions';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { mutedNote } from '@/features/admin/crmStyles';

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay()); // back to Sunday
  return x;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function dayLabel(key: string): string {
  const [y, m, dd] = key.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}
function timeLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Shared week agenda for the schedule page (admin: all sessions) and the
// coach dashboard (scope="own"). Coaches and admins can run (fill attendance)
// or cancel a SCHEDULED session inline.
export function SessionAgenda({ scope, title = 'Schedule' }: { scope?: 'own'; title?: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [rows, setRows] = useState<SessionRecord[] | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const refresh = useCallback(async () => {
    try {
      setRows(
        await sessionsApi.list({
          scope,
          from: isoDay(weekStart),
          to: isoDay(weekEnd)
        })
      );
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the schedule.');
    }
  }, [scope, weekStart, weekEnd]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    studentsApi
      .list()
      .then(setStudents)
      .catch(() => {
        /* attendance picker stays empty */
      });
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const s of rows ?? []) {
      const key = isoDay(new Date(s.date));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startsAt ?? a.date).localeCompare(b.startsAt ?? b.date));
    }
    return map;
  }, [rows]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => isoDay(addDays(weekStart, i))),
    [weekStart]
  );

  function openRun(s: SessionRecord) {
    setRunId(s.id);
    setTopic(s.topic);
    setPresent(new Set(s.attendance.filter((a) => a.present).map((a) => a.studentId)));
  }

  function togglePresent(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function saveRun(s: SessionRecord) {
    if (present.size === 0) {
      setError('Mark at least one student present, or cancel the session instead.');
      return;
    }
    setBusyId(s.id);
    setError(null);
    try {
      await sessionsApi.complete(s.id, {
        topic: topic.trim() || undefined,
        presentStudentIds: Array.from(present)
      });
      setRunId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save attendance.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(s: SessionRecord) {
    if (!window.confirm(`Cancel “${s.topic}” on ${dayLabel(isoDay(new Date(s.date)))}?`)) return;
    setBusyId(s.id);
    setError(null);
    try {
      await sessionsApi.cancel(s.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the session.');
    } finally {
      setBusyId(null);
    }
  }

  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <Panel title={title}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ← Prev
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          This week
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          Next →
        </button>
        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
          {rangeLabel}
        </span>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 12 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!rows && <div style={mutedNote}>Loading…</div>}

      {rows && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {days.map((key) => {
            const list = byDay.get(key) ?? [];
            return (
              <div key={key}>
                <div style={{ ...labelRow }}>{dayLabel(key)}</div>
                {list.length === 0 ? (
                  <div style={{ ...mutedNote, paddingLeft: 4 }}>—</div>
                ) : (
                  list.map((s) => {
                    const chip = sessionStatusChip(s.status);
                    const attended = s.attendance.filter((a) => a.present).length;
                    return (
                      <Fragment key={s.id}>
                        <div style={sessionRow}>
                          <div style={{ minWidth: 66 }} className="mono">
                            {timeLabel(s.startsAt)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.topic}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {s.classSchedule?.venue || s.groupName || '—'}
                              {!scope && s.coach?.user ? ` · ${s.coach.user.email}` : ''}
                              {s.status === 'COMPLETED' ? ` · ${attended} present` : ''}
                            </div>
                          </div>
                          <Chip status={chip.cls} label={chip.label} />
                          {(s.status === 'SCHEDULED' || s.status === 'COMPLETED') && (
                            <button
                              className="btn btn-gold btn-sm"
                              disabled={busyId === s.id}
                              onClick={() => (runId === s.id ? setRunId(null) : openRun(s))}
                            >
                              {s.status === 'COMPLETED' ? 'Edit' : 'Run'}
                            </button>
                          )}
                          {s.status === 'SCHEDULED' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={busyId === s.id}
                              style={{ color: 'var(--red)' }}
                              onClick={() => cancel(s)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        {runId === s.id && (
                          <div style={runPanel}>
                            <label style={{ ...labelRow, marginBottom: 4 }} htmlFor={`topic-${s.id}`}>
                              Topic covered
                            </label>
                            <input
                              id={`topic-${s.id}`}
                              value={topic}
                              onChange={(e) => setTopic(e.target.value)}
                              style={runInput}
                            />
                            <div style={{ ...labelRow, margin: '10px 0 4px' }}>Who attended?</div>
                            {students.length === 0 && (
                              <div style={mutedNote}>No students on your roster.</div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {students.map((st) => (
                                <label
                                  key={st.id}
                                  style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={present.has(st.id)}
                                    onChange={() => togglePresent(st.id)}
                                  />
                                  {studentName(st)}
                                </label>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                              <button
                                className="btn btn-gold btn-sm"
                                disabled={busyId === s.id}
                                onClick={() => saveRun(s)}
                              >
                                {busyId === s.id ? 'Saving…' : 'Save attendance'}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setRunId(null)}
                                disabled={busyId === s.id}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

const labelRow: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--muted)',
  letterSpacing: '0.04em',
  marginBottom: 6
};

const sessionRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  padding: '8px 4px',
  borderBottom: '1px solid var(--line)'
};

const runPanel: React.CSSProperties = {
  background: 'var(--panel-alt)',
  borderRadius: 8,
  padding: 12,
  margin: '2px 0 8px'
};

const runInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  boxSizing: 'border-box'
};
