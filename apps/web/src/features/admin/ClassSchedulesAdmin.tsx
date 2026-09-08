import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  classSchedulesApi,
  scheduleStatusChip,
  SCHEDULE_STATUSES,
  SCHEDULE_STATUS_LABEL,
  WEEKDAYS,
  formatTime,
  type ClassSchedule,
  type ClassScheduleInput,
  type ScheduleStatus
} from '@/lib/class-schedules';
import {
  DELIVERY_TYPES,
  DELIVERY_LABEL,
  LEVEL_LABEL,
  STUDENT_LEVELS,
  formatCrmDate,
  type DeliveryType,
  type StudentLevel
} from '@/lib/enrollments';
import { schoolGroupsApi, type SchoolGroup } from '@/lib/school-groups';
import { coachesApi, coachName, type Coach } from '@/lib/coaches';
import { termsApi, type Term } from '@/lib/terms';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: ClassScheduleInput = {
  title: '',
  deliveryType: 'CENTER',
  weekday: 6,
  startTime: '10:00',
  durationMinutes: 60,
  startDate: '',
  status: 'ACTIVE'
};

export function ClassSchedulesAdmin() {
  const [rows, setRows] = useState<ClassSchedule[] | null>(null);
  const [groups, setGroups] = useState<SchoolGroup[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScheduleStatus | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassScheduleInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [genNote, setGenNote] = useState<string | null>(null);

  async function refresh(next: ScheduleStatus | 'ALL' = filter) {
    try {
      setRows(await classSchedulesApi.list(next === 'ALL' ? {} : { status: next }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load class schedules.');
    }
  }

  useEffect(() => {
    refresh('ALL');
    Promise.all([schoolGroupsApi.list(), coachesApi.list(), termsApi.list()])
      .then(([g, c, t]) => {
        setGroups(g);
        setCoaches(c);
        setTerms(t);
      })
      .catch(() => {
        /* pickers stay empty */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(next: ScheduleStatus | 'ALL') {
    setFilter(next);
    setRows(null);
    refresh(next);
  }

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }

  function startEdit(s: ClassSchedule) {
    setForm({
      title: s.title,
      deliveryType: s.deliveryType,
      schoolGroupId: s.schoolGroupId ?? undefined,
      level: s.level ?? undefined,
      coachId: s.coachId ?? undefined,
      venue: s.venue ?? undefined,
      weekday: s.weekday,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      termId: s.termId ?? undefined,
      startDate: s.startDate.slice(0, 10),
      endDate: s.endDate ? s.endDate.slice(0, 10) : undefined,
      status: s.status,
      capacity: s.capacity ?? undefined,
      notes: s.notes ?? undefined
    });
    setEditingId(s.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: ClassScheduleInput = {
      title: form.title.trim(),
      deliveryType: form.deliveryType,
      schoolGroupId: form.deliveryType === 'SCHOOL_GROUP' ? form.schoolGroupId : undefined,
      level: form.level || undefined,
      coachId: form.coachId || undefined,
      venue: form.venue?.trim() || undefined,
      weekday: form.weekday,
      startTime: form.startTime,
      durationMinutes: form.durationMinutes || 60,
      termId: form.termId || undefined,
      startDate: new Date(form.startDate).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      status: form.status,
      capacity: form.capacity || undefined,
      notes: form.notes?.trim() || undefined
    };
    try {
      if (editingId) await classSchedulesApi.update(editingId, payload);
      else await classSchedulesApi.create(payload);
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the schedule.');
    } finally {
      setSaving(false);
    }
  }

  async function generate(s: ClassSchedule) {
    setBusyId(s.id);
    setGenNote(null);
    setError(null);
    try {
      const res = await classSchedulesApi.generate(s.id);
      setGenNote(
        `${s.title}: created ${res.created} session${res.created === 1 ? '' : 's'}` +
          (res.skipped ? `, skipped ${res.skipped} already there` : '') +
          ` (through ${formatCrmDate(res.to)}).`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate sessions.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(s: ClassSchedule) {
    if (!window.confirm(`Delete “${s.title}”? This cannot be undone.`)) return;
    setBusyId(s.id);
    setError(null);
    try {
      await classSchedulesApi.remove(s.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the schedule.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Class schedules</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>{' '}
            · <Link to="/app/terms" style={{ color: 'var(--gold-soft)' }}>Terms</Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {(['ALL', ...SCHEDULE_STATUSES] as const).map((s) => (
              <button
                key={s}
                className={`child-tab ${filter === s ? 'active' : ''}`}
                onClick={() => changeFilter(s)}
              >
                {s === 'ALL' ? 'All' : SCHEDULE_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {editingId === null && <Button onClick={startNew}>New schedule</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}
      {genNote && (
        <div className="alert-card" style={{ marginBottom: 16, borderColor: 'var(--gold-soft)' }}>
          {genNote}
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit schedule' : 'New schedule'}>
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="sc-title">
                Title
              </label>
              <input
                id="sc-title"
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-delivery">
                    Delivery
                  </label>
                  <select
                    id="sc-delivery"
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
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-level">
                    Level <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <select
                    id="sc-level"
                    style={inputStyle}
                    value={form.level ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        level: (e.target.value || undefined) as StudentLevel | undefined
                      }))
                    }
                  >
                    <option value="">Any level</option>
                    {STUDENT_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABEL[l]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.deliveryType === 'SCHOOL_GROUP' && (
                <>
                  <label style={labelStyle} htmlFor="sc-group">
                    School group
                  </label>
                  <select
                    id="sc-group"
                    style={inputStyle}
                    value={form.schoolGroupId ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, schoolGroupId: e.target.value || undefined }))
                    }
                    required
                  >
                    <option value="">Select…</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.institutionName}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-coach">
                    Coach <span style={{ opacity: 0.6 }}>— needed before generating</span>
                  </label>
                  <select
                    id="sc-coach"
                    style={inputStyle}
                    value={form.coachId ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, coachId: e.target.value || undefined }))}
                  >
                    <option value="">Unassigned</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {coachName(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-venue">
                    Venue <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="sc-venue"
                    style={inputStyle}
                    value={form.venue ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-weekday">
                    Weekday
                  </label>
                  <select
                    id="sc-weekday"
                    style={inputStyle}
                    value={form.weekday}
                    onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-time">
                    Start time
                  </label>
                  <input
                    id="sc-time"
                    type="time"
                    style={inputStyle}
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-duration">
                    Minutes
                  </label>
                  <input
                    id="sc-duration"
                    type="number"
                    min={15}
                    max={480}
                    step={5}
                    style={inputStyle}
                    value={form.durationMinutes ?? 60}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-start">
                    First date
                  </label>
                  <input
                    id="sc-start"
                    type="date"
                    style={inputStyle}
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-end">
                    Last date <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="sc-end"
                    type="date"
                    style={inputStyle}
                    value={form.endDate ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value || undefined }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-term">
                    Term <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <select
                    id="sc-term"
                    style={inputStyle}
                    value={form.termId ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, termId: e.target.value || undefined }))}
                  >
                    <option value="">No term (rolling)</option>
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-capacity">
                    Capacity <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="sc-capacity"
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={form.capacity ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        capacity: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sc-status">
                    Status
                  </label>
                  <select
                    id="sc-status"
                    style={inputStyle}
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as ScheduleStatus }))
                    }
                  >
                    {SCHEDULE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {SCHEDULE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={labelStyle} htmlFor="sc-notes">
                Notes <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="sc-notes"
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create schedule'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Schedules">
        {!rows && <div style={mutedNote}>Loading…</div>}
        {rows && rows.length === 0 && (
          <div style={mutedNote}>
            No schedules {filter === 'ALL' ? 'yet' : `that are ${SCHEDULE_STATUS_LABEL[filter as ScheduleStatus]}`}.
          </div>
        )}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>When</th>
                <th>Coach</th>
                <th>Sessions</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const chip = scheduleStatusChip(s.status);
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {DELIVERY_LABEL[s.deliveryType]}
                        {s.level ? ` · ${LEVEL_LABEL[s.level]}` : ''}
                        {s.schoolGroup ? ` · ${s.schoolGroup.institutionName}` : ''}
                        {s.venue ? ` · ${s.venue}` : ''}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {WEEKDAYS[s.weekday]}s {formatTime(s.startTime)}
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        from {formatCrmDate(s.startDate)}
                        {s.endDate ? ` to ${formatCrmDate(s.endDate)}` : ''}
                        {s.term ? ` · ${s.term.name}` : ''}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {s.coach ? coachName(s.coach) : <span style={{ color: 'var(--red)' }}>unassigned</span>}
                    </td>
                    <td className="mono">{s._count?.sessions ?? 0}</td>
                    <td>
                      <Chip status={chip.cls} label={chip.label} />
                    </td>
                    <td style={rowActions}>
                      <button
                        className="btn btn-gold btn-sm"
                        onClick={() => generate(s)}
                        disabled={busyId === s.id || s.status !== 'ACTIVE' || !s.coachId}
                        style={{ marginRight: 6 }}
                        title={
                          s.status !== 'ACTIVE'
                            ? 'Only active schedules generate sessions'
                            : !s.coachId
                              ? 'Assign a coach first'
                              : undefined
                        }
                      >
                        Generate
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(s)}
                        style={{ marginRight: 6 }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => remove(s)}
                        disabled={busyId === s.id}
                        style={{ color: 'var(--red)' }}
                      >
                        Delete
                      </button>
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
