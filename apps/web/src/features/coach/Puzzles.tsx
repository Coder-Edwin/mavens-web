import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  puzzlesApi,
  puzzleStatusChip,
  type PuzzleAssignment,
  type PuzzleSet,
  type PuzzleSetInput
} from '@/lib/puzzles';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { inputStyle, labelStyle, mutedNote, rowActions } from '@/features/admin/crmStyles';

const EMPTY_SET: PuzzleSetInput = { title: '', description: '', difficulty: '' };

export function Puzzles() {
  const [sets, setSets] = useState<PuzzleSet[] | null>(null);
  const [assignments, setAssignments] = useState<PuzzleAssignment[] | null>(null);
  const [roster, setRoster] = useState<StudentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showNewSet, setShowNewSet] = useState(false);
  const [setForm, setSetForm] = useState<PuzzleSetInput>(EMPTY_SET);
  const [savingSet, setSavingSet] = useState(false);

  const [assignSetId, setAssignSetId] = useState('');
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeSubmitting, setGradeSubmitting] = useState(false);

  async function refresh() {
    try {
      const [setsData, assignmentsData, rosterData] = await Promise.all([
        puzzlesApi.listSets(),
        puzzlesApi.listAssignments('own'),
        studentsApi.list('own')
      ]);
      setSets(setsData);
      setAssignments(assignmentsData);
      setRoster(rosterData);
      setAssignSetId((prev) => prev || setsData[0]?.id || '');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load puzzles.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createSet(e: FormEvent) {
    e.preventDefault();
    setSavingSet(true);
    setError(null);
    try {
      await puzzlesApi.createSet({
        title: setForm.title.trim(),
        description: setForm.description?.trim() || undefined,
        difficulty: setForm.difficulty?.trim() || undefined
      });
      setSetForm(EMPTY_SET);
      setShowNewSet(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this puzzle set.');
    } finally {
      setSavingSet(false);
    }
  }

  function toggleAssignStudent(id: string) {
    setAssignStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function assign(e: FormEvent) {
    e.preventDefault();
    if (!assignSetId || assignStudentIds.length === 0) return;
    setAssigning(true);
    setAssignMessage(null);
    setError(null);
    try {
      await puzzlesApi.assign({
        puzzleSetId: assignSetId,
        studentIds: assignStudentIds,
        dueDate: assignDueDate || undefined
      });
      setAssignMessage(`Assigned to ${assignStudentIds.length} student${assignStudentIds.length === 1 ? '' : 's'}.`);
      setAssignStudentIds([]);
      setAssignDueDate('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign this puzzle set.');
    } finally {
      setAssigning(false);
    }
  }

  async function grade(assignmentId: string) {
    const score = Number(gradeScore);
    if (Number.isNaN(score) || score < 0 || score > 100) return;
    setGradeSubmitting(true);
    setError(null);
    try {
      await puzzlesApi.grade(assignmentId, { score, feedback: gradeFeedback.trim() || undefined });
      setGradingId(null);
      setGradeScore('');
      setGradeFeedback('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not grade this submission.');
    } finally {
      setGradeSubmitting(false);
    }
  }

  if (!sets || !assignments) return <div className="page-sub">Loading puzzles…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Puzzles</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {!showNewSet && <Button onClick={() => setShowNewSet(true)}>New puzzle set</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {showNewSet && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="New puzzle set">
            <form onSubmit={createSet}>
              <label style={labelStyle} htmlFor="ps-title">
                Title
              </label>
              <input
                id="ps-title"
                style={inputStyle}
                value={setForm.title}
                onChange={(e) => setSetForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
              <label style={labelStyle} htmlFor="ps-difficulty">
                Difficulty <span style={{ opacity: 0.6 }}>— optional, e.g. Novice</span>
              </label>
              <input
                id="ps-difficulty"
                style={inputStyle}
                value={setForm.difficulty}
                onChange={(e) => setSetForm((f) => ({ ...f, difficulty: e.target.value }))}
              />
              <label style={labelStyle} htmlFor="ps-description">
                Description <span style={{ opacity: 0.6 }}>— optional, what to solve</span>
              </label>
              <textarea
                id="ps-description"
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={setForm.description}
                onChange={(e) => setSetForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-gold" disabled={savingSet}>
                  {savingSet ? 'Saving…' : 'Create set'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowNewSet(false);
                    setSetForm(EMPTY_SET);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>
        <Panel title="Your puzzle sets">
          {sets.length === 0 ? (
            <div style={mutedNote}>No puzzle sets yet. Use “New puzzle set” to add the first one.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sets.map((s) => (
                <div key={s.id} style={{ fontSize: 13 }}>
                  <b>{s.title}</b>
                  {s.difficulty && <span style={{ color: 'var(--muted)' }}> · {s.difficulty}</span>}
                  {s.description && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Assign a set">
          {sets.length === 0 ? (
            <div style={mutedNote}>Create a puzzle set first.</div>
          ) : roster.length === 0 ? (
            <div style={mutedNote}>You have no students assigned to you yet.</div>
          ) : (
            <form onSubmit={assign}>
              <label style={labelStyle} htmlFor="pa-set">
                Puzzle set
              </label>
              <select
                id="pa-set"
                style={inputStyle}
                value={assignSetId}
                onChange={(e) => setAssignSetId(e.target.value)}
              >
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              <label style={labelStyle} htmlFor="pa-due">
                Due date <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="pa-due"
                type="date"
                style={inputStyle}
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
              />

              <div style={{ ...labelStyle, marginBottom: 8 }}>Assign to</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {roster.map((s) => (
                  <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={assignStudentIds.includes(s.id)}
                      onChange={() => toggleAssignStudent(s.id)}
                    />
                    {studentName(s)}
                  </label>
                ))}
              </div>

              <Button type="submit" disabled={assigning || assignStudentIds.length === 0}>
                {assigning ? 'Assigning…' : 'Assign'}
              </Button>
              {assignMessage && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold-soft)' }}>{assignMessage}</div>
              )}
            </form>
          )}
        </Panel>
      </div>

      <Panel title="Assignments">
        {assignments.length === 0 ? (
          <div style={mutedNote}>No puzzles assigned yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Set</th>
                <th>Due</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const chip = puzzleStatusChip(a.status);
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>
                      {a.student ? `${a.student.firstName} ${a.student.lastName}` : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>{a.puzzleSet?.title ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{a.dueDate ? a.dueDate.slice(0, 10) : '—'}</td>
                    <td>
                      <Chip status={chip.cls} label={chip.label} />
                      {a.status === 'GRADED' && a.submission?.score != null && (
                        <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--muted)' }}>
                          {a.submission.score}/100
                        </span>
                      )}
                    </td>
                    <td style={rowActions}>
                      {a.status === 'SUBMITTED' &&
                        (gradingId === a.id ? (
                          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="Score"
                              value={gradeScore}
                              onChange={(e) => setGradeScore(e.target.value)}
                              style={{ ...inputStyle, width: 70, margin: 0 }}
                            />
                            <input
                              placeholder="Feedback (optional)"
                              value={gradeFeedback}
                              onChange={(e) => setGradeFeedback(e.target.value)}
                              style={{ ...inputStyle, width: 160, margin: 0 }}
                            />
                            <button
                              className="btn btn-gold btn-sm"
                              disabled={gradeSubmitting}
                              onClick={() => grade(a.id)}
                            >
                              Save
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setGradingId(null)}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setGradingId(a.id);
                              setGradeScore('');
                              setGradeFeedback('');
                            }}
                          >
                            Grade
                          </button>
                        ))}
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
