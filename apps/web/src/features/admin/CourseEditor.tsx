import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  coursesApi,
  courseStatusChip,
  ASSIGNMENT_STATUS_LABEL,
  type Course,
  type CourseAssignment,
  type CourseLesson
} from '@/lib/courses';
import { LEVEL_LABEL } from '@/lib/enrollments';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { inputStyle, labelStyle, mutedNote } from './crmStyles';

const EMPTY_LESSON = { title: '', body: '', fen: '', videoUrl: '', estimatedMinutes: '' };

export function CourseEditor() {
  const { id = '' } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingLessonIn, setAddingLessonIn] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ ...EMPTY_LESSON });
  const [editingLesson, setEditingLesson] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignNote, setAssignNote] = useState<string | null>(null);

  async function load() {
    try {
      const [c, a] = await Promise.all([
        coursesApi.get(id),
        coursesApi.listAssignments({ courseId: id })
      ]);
      setCourse(c);
      setAssignments(a);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the course.');
    }
  }

  useEffect(() => {
    load();
    studentsApi
      .list()
      .then(setStudents)
      .catch(() => {
        /* picker stays empty */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  async function addModule(e: FormEvent) {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    await run(() => coursesApi.addModule(id, { title: newModuleTitle.trim() }));
    setNewModuleTitle('');
  }

  async function addLesson(moduleId: string, e: FormEvent) {
    e.preventDefault();
    if (!lessonForm.title.trim() || !lessonForm.body.trim()) return;
    await run(() =>
      coursesApi.addLesson(moduleId, {
        title: lessonForm.title.trim(),
        body: lessonForm.body,
        fen: lessonForm.fen.trim() || undefined,
        videoUrl: lessonForm.videoUrl.trim() || undefined,
        estimatedMinutes: lessonForm.estimatedMinutes ? Number(lessonForm.estimatedMinutes) : undefined
      })
    );
    setAddingLessonIn(null);
    setLessonForm({ ...EMPTY_LESSON });
  }

  async function saveLesson(lesson: CourseLesson, e: FormEvent) {
    e.preventDefault();
    await run(() =>
      coursesApi.updateLesson(lesson.id, {
        title: lessonForm.title.trim() || undefined,
        body: lessonForm.body,
        fen: lessonForm.fen.trim() || undefined,
        videoUrl: lessonForm.videoUrl.trim() || undefined,
        estimatedMinutes: lessonForm.estimatedMinutes ? Number(lessonForm.estimatedMinutes) : undefined
      })
    );
    setEditingLesson(null);
  }

  function startEditLesson(l: CourseLesson) {
    setEditingLesson(l.id);
    setAddingLessonIn(null);
    setLessonForm({
      title: l.title,
      body: l.body,
      fen: l.fen ?? '',
      videoUrl: l.videoUrl ?? '',
      estimatedMinutes: l.estimatedMinutes != null ? String(l.estimatedMinutes) : ''
    });
  }

  function togglePick(sid: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  async function assign() {
    if (picked.size === 0) return;
    setBusy(true);
    setError(null);
    setAssignNote(null);
    try {
      const res = await coursesApi.assign(id, { studentIds: Array.from(picked) });
      setAssignNote(`Assigned ${res.assigned}, skipped ${res.skipped} already on it.`);
      setPicked(new Set());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign the course.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !course) {
    return (
      <div className="panel" style={{ borderColor: 'var(--red)' }}>
        <div className="panel-title">Something went wrong</div>
        <p style={mutedNote}>{error}</p>
      </div>
    );
  }
  if (!course) return <div className="page-sub">Loading course…</div>;

  const chip = courseStatusChip(course.status);
  const assignedIds = new Set(assignments.map((a) => a.studentId));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{course.title}</div>
          <div className="page-sub">
            <Link to="/app/courses" style={{ color: 'var(--gold-soft)' }}>
              ← All courses
            </Link>{' '}
            · {course.level ? LEVEL_LABEL[course.level] : 'Any level'}
          </div>
        </div>
        <Chip status={chip.cls} label={chip.label} />
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      <Panel title="Curriculum">
        {course.modules && course.modules.length === 0 && (
          <div style={mutedNote}>No modules yet — add the first one below.</div>
        )}
        {course.modules?.map((m) => (
          <div key={m.id} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete module “${m.title}” and its lessons?`))
                    run(() => coursesApi.removeModule(m.id));
                }}
                style={{ color: 'var(--red)' }}
              >
                Delete
              </button>
            </div>
            <div style={{ paddingLeft: 12, marginTop: 6 }}>
              {m.lessons.length === 0 && <div style={mutedNote}>No lessons.</div>}
              {m.lessons.map((l) =>
                editingLesson === l.id ? (
                  <form key={l.id} onSubmit={(e) => saveLesson(l, e)} style={lessonPanel}>
                    <LessonFields form={lessonForm} setForm={setLessonForm} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingLesson(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div key={l.id} style={lessonRow}>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      {l.title}
                      {l.estimatedMinutes ? (
                        <span style={{ color: 'var(--muted)' }}> · {l.estimatedMinutes} min</span>
                      ) : null}
                      {l.fen ? <span style={{ color: 'var(--muted)' }}> · FEN</span> : null}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEditLesson(l)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)' }}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete lesson “${l.title}”?`))
                          run(() => coursesApi.removeLesson(l.id));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )
              )}

              {addingLessonIn === m.id ? (
                <form onSubmit={(e) => addLesson(m.id, e)} style={lessonPanel}>
                  <LessonFields form={lessonForm} setForm={setLessonForm} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
                      Add lesson
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setAddingLessonIn(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 6 }}
                  onClick={() => {
                    setAddingLessonIn(m.id);
                    setEditingLesson(null);
                    setLessonForm({ ...EMPTY_LESSON });
                  }}
                >
                  + Lesson
                </button>
              )}
            </div>
          </div>
        ))}

        <form onSubmit={addModule} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            aria-label="New module title"
            placeholder="New module title"
            style={{ ...inputStyle, margin: 0, flex: 1 }}
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-gold btn-sm" disabled={busy || !newModuleTitle.trim()}>
            Add module
          </button>
        </form>
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel title="Assign to students">
          {course.status !== 'PUBLISHED' && (
            <div className="alert-card" style={{ marginBottom: 12 }}>
              Publish the course before assigning it.
            </div>
          )}
          {assignNote && (
            <div className="alert-card" style={{ marginBottom: 12, borderColor: 'var(--gold-soft)' }}>
              {assignNote}
            </div>
          )}
          {assignments.length > 0 && (
            <table>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 13 }}>
                      {a.student ? `${a.student.firstName} ${a.student.lastName}` : a.studentId}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {ASSIGNMENT_STATUS_LABEL[a.status]}
                      {a.progress ? ` · ${a.progress.done}/${a.progress.total}` : ''}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)' }}
                        disabled={busy}
                        onClick={() => run(() => coursesApi.removeAssignment(a.id))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ ...labelStyle, margin: '12px 0 6px' }}>Add students</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {students
              .filter((s) => !assignedIds.has(s.id))
              .map((s) => (
                <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} />
                  {studentName(s)}
                </label>
              ))}
          </div>
          <button
            className="btn btn-gold btn-sm"
            style={{ marginTop: 10 }}
            disabled={busy || picked.size === 0 || course.status !== 'PUBLISHED'}
            onClick={assign}
          >
            Assign {picked.size || ''}
          </button>
        </Panel>
      </div>
    </>
  );
}

function LessonFields({
  form,
  setForm
}: {
  form: typeof EMPTY_LESSON;
  setForm: (u: (f: typeof EMPTY_LESSON) => typeof EMPTY_LESSON) => void;
}) {
  return (
    <>
      <label style={labelStyle} htmlFor="ls-title">
        Lesson title
      </label>
      <input
        id="ls-title"
        style={inputStyle}
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        required
      />
      <label style={labelStyle} htmlFor="ls-body">
        Body <span style={{ opacity: 0.6 }}>— blank lines separate paragraphs</span>
      </label>
      <textarea
        id="ls-body"
        style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
        value={form.body}
        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        required
      />
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle} htmlFor="ls-fen">
            Study position (FEN) <span style={{ opacity: 0.6 }}>— optional</span>
          </label>
          <input
            id="ls-fen"
            style={inputStyle}
            value={form.fen}
            onChange={(e) => setForm((f) => ({ ...f, fen: e.target.value }))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="ls-min">
            Minutes <span style={{ opacity: 0.6 }}>— optional</span>
          </label>
          <input
            id="ls-min"
            type="number"
            min={1}
            style={inputStyle}
            value={form.estimatedMinutes}
            onChange={(e) => setForm((f) => ({ ...f, estimatedMinutes: e.target.value }))}
          />
        </div>
      </div>
      <label style={labelStyle} htmlFor="ls-video">
        Video URL <span style={{ opacity: 0.6 }}>— optional</span>
      </label>
      <input
        id="ls-video"
        style={inputStyle}
        value={form.videoUrl}
        onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
      />
    </>
  );
}

const lessonRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid var(--line)'
};
const lessonPanel: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 12,
  margin: '6px 0'
};
