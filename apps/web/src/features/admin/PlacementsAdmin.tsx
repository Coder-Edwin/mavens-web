import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  placementsApi,
  placementStatusChip,
  PLACEMENT_STATUS_LABEL,
  type PlacementAssessment,
  type PlacementStatus,
  type SchedulePlacementInput
} from '@/lib/placements';
import { LEVEL_LABEL, STUDENT_LEVELS, formatCrmDate, type StudentLevel } from '@/lib/enrollments';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

type Tab = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'DUE' | 'ALL';
const TABS: { key: Tab; label: string }[] = [
  { key: 'SCHEDULED', label: 'Queue' },
  { key: 'DUE', label: 'Review due' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'ALL', label: 'All' }
];

const EMPTY_FORM: SchedulePlacementInput = { studentId: '', scheduledFor: '', notes: '' };

export function PlacementsAdmin() {
  const [rows, setRows] = useState<PlacementAssessment[] | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('SCHEDULED');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SchedulePlacementInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resultLevel, setResultLevel] = useState<Record<string, StudentLevel>>({});

  async function refresh(next: Tab = tab) {
    try {
      if (next === 'DUE') {
        setRows(await placementsApi.list({ dueBefore: new Date().toISOString() }));
      } else if (next === 'ALL') {
        setRows(await placementsApi.list());
      } else {
        setRows(await placementsApi.list({ status: next }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load placement assessments.');
    }
  }

  useEffect(() => {
    refresh('SCHEDULED');
    studentsApi
      .list()
      .then(setStudents)
      .catch(() => {
        /* picker stays empty */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTab(next: Tab) {
    setTab(next);
    setRows(null);
    refresh(next);
  }

  async function handleSchedule(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await placementsApi.schedule({
        studentId: form.studentId,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
        notes: form.notes?.trim() || undefined
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not schedule the assessment.');
    } finally {
      setSaving(false);
    }
  }

  async function complete(a: PlacementAssessment) {
    const level = resultLevel[a.id] ?? 'NOVICE';
    if (!window.confirm(`Record ${studentLabel(a)} as ${LEVEL_LABEL[level]}? This sets their level.`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      await placementsApi.complete(a.id, { resultLevel: level });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete the assessment.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(a: PlacementAssessment) {
    if (!window.confirm(`Cancel the assessment for ${studentLabel(a)}?`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      await placementsApi.cancel(a.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the assessment.');
    } finally {
      setBusyId(null);
    }
  }

  function studentLabel(a: PlacementAssessment): string {
    if (a.student) return `${a.student.firstName} ${a.student.lastName}`;
    const s = students.find((x) => x.id === a.studentId);
    return s ? studentName(s) : a.studentId;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Placement queue</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`child-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => changeTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!showForm && <Button onClick={() => setShowForm(true)}>Schedule assessment</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="Schedule a placement assessment">
            <form onSubmit={handleSchedule}>
              <label style={labelStyle} htmlFor="pa-student">
                Student
              </label>
              <select
                id="pa-student"
                style={inputStyle}
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                required
              >
                <option value="">Select a student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {studentName(s)}
                  </option>
                ))}
              </select>

              <label style={labelStyle} htmlFor="pa-when">
                Scheduled for <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="pa-when"
                type="datetime-local"
                style={inputStyle}
                value={form.scheduledFor}
                onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
              />

              <label style={labelStyle} htmlFor="pa-notes">
                Notes <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="pa-notes"
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving || !form.studentId}>
                  {saving ? 'Scheduling…' : 'Schedule'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowForm(false);
                    setForm(EMPTY_FORM);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Assessments">
        {!rows && <div style={mutedNote}>Loading…</div>}
        {rows && rows.length === 0 && <div style={mutedNote}>Nothing here.</div>}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Result</th>
                <th>Review due</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const chip = placementStatusChip(a.status);
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{studentLabel(a)}</div>
                      {a.enrollmentId && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          linked to an enrollment
                        </div>
                      )}
                      {a.notes && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, maxWidth: 320 }}>
                          {a.notes}
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {a.scheduledFor ? formatCrmDate(a.scheduledFor) : 'unscheduled'}
                    </td>
                    <td>
                      <Chip status={chip.cls} label={chip.label} />
                    </td>
                    <td style={{ fontSize: 13 }}>{a.resultLevel ? LEVEL_LABEL[a.resultLevel] : '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {formatCrmDate(a.nextReviewDue)}
                    </td>
                    <td style={rowActions}>
                      {a.status === 'SCHEDULED' ? (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <select
                            aria-label={`Result level for ${studentLabel(a)}`}
                            value={resultLevel[a.id] ?? 'NOVICE'}
                            onChange={(e) =>
                              setResultLevel((m) => ({ ...m, [a.id]: e.target.value as StudentLevel }))
                            }
                            style={{ ...inputStyle, width: 'auto', margin: 0, padding: '6px 8px' }}
                          >
                            {STUDENT_LEVELS.map((l) => (
                              <option key={l} value={l}>
                                {LEVEL_LABEL[l]}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-gold btn-sm"
                            disabled={busyId === a.id}
                            onClick={() => complete(a)}
                          >
                            Complete
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={busyId === a.id}
                            style={{ color: 'var(--red)' }}
                            onClick={() => cancel(a)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span style={mutedNote}>
                          {a.completedAt ? `done ${formatCrmDate(a.completedAt)}` : PLACEMENT_STATUS_LABEL[a.status as PlacementStatus]}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
