import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  coursesApi,
  courseStatusChip,
  COURSE_STATUSES,
  COURSE_STATUS_LABEL,
  type Course,
  type CourseInput,
  type CourseStatus
} from '@/lib/courses';
import { LEVEL_LABEL, STUDENT_LEVELS, type StudentLevel } from '@/lib/enrollments';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: CourseInput = { title: '', summary: '', status: 'DRAFT' };

export function CoursesAdmin() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CourseStatus | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh(next: CourseStatus | 'ALL' = filter) {
    try {
      setRows(await coursesApi.list(next === 'ALL' ? {} : { status: next }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load courses.');
    }
  }

  useEffect(() => {
    refresh('ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(next: CourseStatus | 'ALL') {
    setFilter(next);
    setRows(null);
    refresh(next);
  }

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }
  function startEdit(c: Course) {
    setForm({
      title: c.title,
      summary: c.summary ?? '',
      level: c.level,
      status: c.status,
      coverImageUrl: c.coverImageUrl ?? undefined,
      estimatedHours: c.estimatedHours ?? undefined
    });
    setEditingId(c.id);
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: CourseInput = {
      title: form.title.trim(),
      summary: form.summary?.trim() || undefined,
      level: form.level ?? null,
      status: form.status,
      coverImageUrl: form.coverImageUrl?.trim() || undefined,
      estimatedHours: form.estimatedHours || undefined
    };
    try {
      if (editingId) await coursesApi.update(editingId, payload);
      else {
        const created = await coursesApi.create(payload);
        cancelEdit();
        await refresh();
        navigate(`/app/courses/${created.id}`);
        return;
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the course.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(c: Course, status: CourseStatus) {
    setBusyId(c.id);
    setError(null);
    try {
      await coursesApi.update(c.id, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the course.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Course) {
    if (!window.confirm(`Delete “${c.title}”?`)) return;
    setBusyId(c.id);
    setError(null);
    try {
      await coursesApi.remove(c.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the course.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Courses</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {(['ALL', ...COURSE_STATUSES] as const).map((s) => (
              <button
                key={s}
                className={`child-tab ${filter === s ? 'active' : ''}`}
                onClick={() => changeFilter(s)}
              >
                {s === 'ALL' ? 'All' : COURSE_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {editingId === null && <Button onClick={startNew}>New course</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit course' : 'New course'}>
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="co-title">
                Title
              </label>
              <input
                id="co-title"
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />

              <label style={labelStyle} htmlFor="co-summary">
                Summary <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="co-summary"
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-level">
                    Level <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <select
                    id="co-level"
                    style={inputStyle}
                    value={form.level ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        level: (e.target.value || null) as StudentLevel | null
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
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-hours">
                    Est. hours <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="co-hours"
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={form.estimatedHours ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        estimatedHours: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-status">
                    Status
                  </label>
                  <select
                    id="co-status"
                    style={inputStyle}
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CourseStatus }))}
                  >
                    {COURSE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {COURSE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create & build'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Courses">
        {!rows && <div style={mutedNote}>Loading…</div>}
        {rows && rows.length === 0 && (
          <div style={mutedNote}>
            No courses {filter === 'ALL' ? 'yet' : `that are ${COURSE_STATUS_LABEL[filter as CourseStatus]}`}.
          </div>
        )}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Level</th>
                <th>Modules</th>
                <th>Assigned</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const chip = courseStatusChip(c.status);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/app/courses/${c.id}`} style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {c.title}
                      </Link>
                      {c.summary && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, maxWidth: 360 }}>
                          {c.summary}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{c.level ? LEVEL_LABEL[c.level] : 'Any'}</td>
                    <td className="mono">{c._count?.modules ?? c.modules?.length ?? 0}</td>
                    <td className="mono">{c._count?.assignments ?? 0}</td>
                    <td>
                      <Chip status={chip.cls} label={chip.label} />
                    </td>
                    <td style={rowActions}>
                      <Link
                        to={`/app/courses/${c.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ marginRight: 6 }}
                      >
                        Open
                      </Link>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(c)}
                        style={{ marginRight: 6 }}
                      >
                        Edit
                      </button>
                      {c.status !== 'PUBLISHED' ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === c.id}
                          onClick={() => setStatus(c, 'PUBLISHED')}
                          style={{ marginRight: 6 }}
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === c.id}
                          onClick={() => setStatus(c, 'ARCHIVED')}
                          style={{ marginRight: 6 }}
                        >
                          Archive
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => remove(c)}
                        disabled={busyId === c.id}
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
