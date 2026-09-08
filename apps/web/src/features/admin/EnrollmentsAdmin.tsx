import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  enrollmentsApi,
  enrollmentStatusChip,
  DELIVERY_TYPES,
  DELIVERY_LABEL,
  ENROLLMENT_STATUSES,
  ENROLLMENT_STATUS_LABEL,
  LEVEL_LABEL,
  STUDENT_LEVELS,
  formatCrmDate,
  type CreateEnrollmentInput,
  type DeliveryType,
  type Enrollment,
  type EnrollmentStatus,
  type StudentLevel
} from '@/lib/enrollments';
import { schoolGroupsApi, type SchoolGroup } from '@/lib/school-groups';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Created',
  PLACED: 'Placed',
  LEVEL_CHANGE: 'Level changed',
  COACH_CHANGE: 'Coach changed',
  DELIVERY_CHANGE: 'Delivery changed',
  PAUSED: 'Paused',
  RESUMED: 'Resumed',
  WITHDRAWN: 'Withdrawn',
  WAITLISTED: 'Waitlisted'
};

const EMPTY_FORM: CreateEnrollmentInput = {
  studentId: '',
  deliveryType: 'CENTER',
  schoolGroupId: undefined,
  level: undefined,
  waitlisted: false,
  note: ''
};

export function EnrollmentsAdmin() {
  const [rows, setRows] = useState<Enrollment[] | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [groups, setGroups] = useState<SchoolGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EnrollmentStatus | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateEnrollmentInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [placeLevel, setPlaceLevel] = useState<StudentLevel>('NOVICE');

  async function refresh(next: EnrollmentStatus | 'ALL' = filter) {
    try {
      setRows(await enrollmentsApi.list(next === 'ALL' ? {} : { status: next }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load enrollments.');
    }
  }

  useEffect(() => {
    refresh('ALL');
    Promise.all([studentsApi.list(), schoolGroupsApi.list()])
      .then(([s, g]) => {
        setStudents(s);
        setGroups(g);
      })
      .catch(() => {
        /* pickers stay empty; the list still works */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentById = useMemo(() => {
    const m = new Map<string, StudentRecord>();
    students.forEach((s) => m.set(s.id, s));
    return m;
  }, [students]);

  function changeFilter(next: EnrollmentStatus | 'ALL') {
    setFilter(next);
    setRows(null);
    setExpandedId(null);
    refresh(next);
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setPlaceLevel('NOVICE');
    try {
      const full = await enrollmentsApi.get(id);
      setRows((prev) => prev?.map((r) => (r.id === id ? full : r)) ?? prev);
    } catch {
      /* keep the summary row */
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: CreateEnrollmentInput = {
      studentId: form.studentId,
      deliveryType: form.deliveryType,
      schoolGroupId: form.deliveryType === 'SCHOOL_GROUP' ? form.schoolGroupId : undefined,
      level: form.level || undefined,
      waitlisted: form.waitlisted || undefined,
      note: form.note?.trim() || undefined
    };
    try {
      await enrollmentsApi.create(payload);
      setShowForm(false);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the enrollment.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      const full = await enrollmentsApi.get(id);
      setRows((prev) => prev?.map((r) => (r.id === id ? full : r)) ?? prev);
      if (filter !== 'ALL') await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the enrollment.');
    } finally {
      setBusyId(null);
    }
  }

  function noteFor(action: string): string | undefined {
    const n = window.prompt(`Optional note for “${action}” (leave blank to skip):`, '');
    return n?.trim() || undefined;
  }

  const canPlace = (s: EnrollmentStatus) => s === 'PENDING_PLACEMENT' || s === 'WAITLISTED';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Enrollments</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {(['ALL', ...ENROLLMENT_STATUSES] as const).map((s) => (
              <button
                key={s}
                className={`child-tab ${filter === s ? 'active' : ''}`}
                onClick={() => changeFilter(s)}
              >
                {s === 'ALL' ? 'All' : ENROLLMENT_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {!showForm && <Button onClick={() => setShowForm(true)}>New enrollment</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="New enrollment">
            <form onSubmit={handleCreate}>
              <label style={labelStyle} htmlFor="en-student">
                Student
              </label>
              <select
                id="en-student"
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

              <label style={labelStyle} htmlFor="en-delivery">
                Delivery
              </label>
              <select
                id="en-delivery"
                style={inputStyle}
                value={form.deliveryType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deliveryType: e.target.value as DeliveryType }))
                }
              >
                {DELIVERY_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {DELIVERY_LABEL[d]}
                  </option>
                ))}
              </select>

              {form.deliveryType === 'SCHOOL_GROUP' && (
                <>
                  <label style={labelStyle} htmlFor="en-group">
                    School group
                  </label>
                  <select
                    id="en-group"
                    style={inputStyle}
                    value={form.schoolGroupId ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, schoolGroupId: e.target.value || undefined }))
                    }
                    required
                  >
                    <option value="">Select a school group…</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.institutionName}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label style={labelStyle} htmlFor="en-level">
                Level <span style={{ opacity: 0.6 }}>— optional; setting it places the enrollment now</span>
              </label>
              <select
                id="en-level"
                style={inputStyle}
                value={form.level ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, level: (e.target.value || undefined) as StudentLevel | undefined }))
                }
              >
                <option value="">Not set — schedule a placement</option>
                {STUDENT_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </select>

              <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={form.waitlisted ?? false}
                  onChange={(e) => setForm((f) => ({ ...f, waitlisted: e.target.checked }))}
                />
                Start on the waitlist
              </label>

              <label style={labelStyle} htmlFor="en-note">
                Note <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="en-note"
                style={inputStyle}
                value={form.note ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving || !form.studentId}>
                  {saving ? 'Creating…' : 'Create enrollment'}
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

      <Panel title="Enrollments">
        {!rows && <div style={mutedNote}>Loading…</div>}
        {rows && rows.length === 0 && (
          <div style={mutedNote}>
            No enrollments {filter === 'ALL' ? 'yet' : `with status “${ENROLLMENT_STATUS_LABEL[filter as EnrollmentStatus]}”`}.
          </div>
        )}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Delivery</th>
                <th>Level</th>
                <th>Status</th>
                <th>Started</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const chip = enrollmentStatusChip(r.status);
                const name = r.student
                  ? `${r.student.firstName} ${r.student.lastName}`
                  : studentById.get(r.studentId)
                    ? studentName(studentById.get(r.studentId)!)
                    : r.studentId;
                const expanded = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>{name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {r.clientType === 'INSTITUTION' ? 'Institution' : 'Individual'}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {DELIVERY_LABEL[r.deliveryType]}
                        {r.schoolGroup && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {r.schoolGroup.institutionName}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{r.level ? LEVEL_LABEL[r.level] : '—'}</td>
                      <td>
                        <Chip status={chip.cls} label={chip.label} />
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formatCrmDate(r.startDate)}
                      </td>
                      <td style={rowActions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(r.id)}>
                          {expanded ? 'Hide' : 'Manage'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--panel-alt)' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            {canPlace(r.status) && (
                              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                <select
                                  aria-label="Placement level"
                                  value={placeLevel}
                                  onChange={(e) => setPlaceLevel(e.target.value as StudentLevel)}
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
                                  disabled={busyId === r.id}
                                  onClick={() =>
                                    runAction(r.id, () =>
                                      enrollmentsApi.place(r.id, { level: placeLevel })
                                    )
                                  }
                                >
                                  Place
                                </button>
                              </span>
                            )}
                            {r.status === 'PENDING_PLACEMENT' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={busyId === r.id}
                                onClick={() =>
                                  runAction(r.id, () =>
                                    enrollmentsApi.waitlist(r.id, { note: noteFor('Waitlist') })
                                  )
                                }
                              >
                                Waitlist
                              </button>
                            )}
                            {r.status === 'ACTIVE' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={busyId === r.id}
                                onClick={() =>
                                  runAction(r.id, () =>
                                    enrollmentsApi.pause(r.id, { note: noteFor('Pause') })
                                  )
                                }
                              >
                                Pause
                              </button>
                            )}
                            {r.status === 'PAUSED' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={busyId === r.id}
                                onClick={() =>
                                  runAction(r.id, () =>
                                    enrollmentsApi.resume(r.id, { note: noteFor('Resume') })
                                  )
                                }
                              >
                                Resume
                              </button>
                            )}
                            {r.status !== 'WITHDRAWN' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--red)' }}
                                disabled={busyId === r.id}
                                onClick={() => {
                                  if (!window.confirm(`Withdraw ${name}'s enrollment?`)) return;
                                  runAction(r.id, () =>
                                    enrollmentsApi.withdraw(r.id, { note: noteFor('Withdraw') })
                                  );
                                }}
                              >
                                Withdraw
                              </button>
                            )}
                          </div>
                          <div style={{ ...labelStyle, marginBottom: 6 }}>History</div>
                          {!r.events && <div style={mutedNote}>Loading history…</div>}
                          {r.events && r.events.length === 0 && (
                            <div style={mutedNote}>No events recorded.</div>
                          )}
                          {r.events && r.events.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {r.events.map((ev) => (
                                <div key={ev.id} style={{ fontSize: 12 }}>
                                  <span className="mono" style={{ color: 'var(--muted)' }}>
                                    {formatCrmDate(ev.at)}
                                  </span>{' '}
                                  <b>{EVENT_LABEL[ev.type] ?? ev.type}</b>
                                  {(ev.fromValue || ev.toValue) && (
                                    <>
                                      {' '}
                                      {ev.fromValue ?? '∅'} → {ev.toValue ?? '∅'}
                                    </>
                                  )}
                                  {ev.note && (
                                    <span style={{ color: 'var(--muted)' }}> — {ev.note}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
