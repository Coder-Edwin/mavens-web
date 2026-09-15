import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { lessonPlansApi, type LessonPlan, type LessonPlanInput } from '@/lib/lesson-plans';
import { inputStyle, labelStyle, mutedNote, rowActions } from '@/features/admin/crmStyles';

const EMPTY: LessonPlanInput = { title: '', objectives: '', materialUrl: '', difficulty: '' };

export function LessonPlans() {
  const [plans, setPlans] = useState<LessonPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, '' = new
  const [form, setForm] = useState<LessonPlanInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setPlans(await lessonPlansApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load lesson plans.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }

  function startEdit(p: LessonPlan) {
    setForm({
      title: p.title,
      objectives: p.objectives ?? '',
      materialUrl: p.materialUrl ?? '',
      difficulty: p.difficulty ?? ''
    });
    setEditingId(p.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: LessonPlanInput = {
      title: form.title.trim(),
      objectives: form.objectives?.trim() || undefined,
      materialUrl: form.materialUrl?.trim() || undefined,
      difficulty: form.difficulty?.trim() || undefined
    };
    try {
      if (editingId) await lessonPlansApi.update(editingId, payload);
      else await lessonPlansApi.create(payload);
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this lesson plan.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this lesson plan?')) return;
    setBusyId(id);
    setError(null);
    try {
      await lessonPlansApi.remove(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this lesson plan.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Lesson Plans</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {editingId === null && <Button onClick={startNew}>New lesson plan</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit lesson plan' : 'New lesson plan'}>
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="lp-title">
                Title
              </label>
              <input
                id="lp-title"
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="lp-difficulty">
                    Difficulty <span style={{ opacity: 0.6 }}>— optional, e.g. Novice</span>
                  </label>
                  <input
                    id="lp-difficulty"
                    style={inputStyle}
                    value={form.difficulty}
                    onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle} htmlFor="lp-material">
                    Material link <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="lp-material"
                    style={inputStyle}
                    value={form.materialUrl}
                    onChange={(e) => setForm((f) => ({ ...f, materialUrl: e.target.value }))}
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="lp-objectives">
                Objectives <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="lp-objectives"
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                value={form.objectives}
                onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create lesson plan'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Your library">
        {!plans && <div style={mutedNote}>Loading…</div>}
        {plans && plans.length === 0 && (
          <div style={mutedNote}>No lesson plans yet. Use “New lesson plan” to add the first one.</div>
        )}
        {plans && plans.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Objectives</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>
                    {p.materialUrl ? (
                      <a href={p.materialUrl} target="_blank" rel="noreferrer">
                        {p.title}
                      </a>
                    ) : (
                      p.title
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{p.difficulty || '—'}</td>
                  <td style={{ fontSize: 13, maxWidth: 360 }}>{p.objectives || '—'}</td>
                  <td style={rowActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)', marginLeft: 6 }}
                      disabled={busyId === p.id}
                      onClick={() => remove(p.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
