import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  termsApi,
  termStatusChip,
  TERM_STATUSES,
  TERM_STATUS_LABEL,
  type Term,
  type TermInput,
  type TermStatus
} from '@/lib/terms';
import { formatCrmDate } from '@/lib/enrollments';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: TermInput = { name: '', startDate: '', endDate: '', status: 'PLANNED', notes: '' };

export function TermsAdmin() {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TermInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setTerms(await termsApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load terms.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }

  function startEdit(t: Term) {
    setForm({
      name: t.name,
      startDate: t.startDate.slice(0, 10),
      endDate: t.endDate.slice(0, 10),
      status: t.status,
      notes: t.notes ?? ''
    });
    setEditingId(t.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: TermInput = {
      name: form.name.trim(),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      status: form.status,
      notes: form.notes?.trim() || undefined
    };
    try {
      if (editingId) await termsApi.update(editingId, payload);
      else await termsApi.create(payload);
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the term.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Term) {
    if (!window.confirm(`Delete “${t.name}”? This cannot be undone.`)) return;
    setBusyId(t.id);
    setError(null);
    try {
      await termsApi.remove(t.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the term.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Terms</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {editingId === null && <Button onClick={startNew}>New term</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit term' : 'New term'}>
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="tm-name">
                Name
              </label>
              <input
                id="tm-name"
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="tm-start">
                    Starts
                  </label>
                  <input
                    id="tm-start"
                    type="date"
                    style={inputStyle}
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="tm-end">
                    Ends
                  </label>
                  <input
                    id="tm-end"
                    type="date"
                    style={inputStyle}
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="tm-status">
                Status
              </label>
              <select
                id="tm-status"
                style={inputStyle}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TermStatus }))}
              >
                {TERM_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TERM_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>

              <label style={labelStyle} htmlFor="tm-notes">
                Notes <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="tm-notes"
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create term'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Terms">
        {!terms && <div style={mutedNote}>Loading…</div>}
        {terms && terms.length === 0 && (
          <div style={mutedNote}>No terms yet. The club can also run without terms (rolling enrollment).</div>
        )}
        {terms && terms.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Dates</th>
                <th>Schedules</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => {
                const chip = termStatusChip(t.status);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {formatCrmDate(t.startDate)} → {formatCrmDate(t.endDate)}
                    </td>
                    <td className="mono">{t._count?.schedules ?? 0}</td>
                    <td>
                      <Chip status={chip.cls} label={chip.label} />
                    </td>
                    <td style={rowActions}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(t)}
                        style={{ marginRight: 6 }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => remove(t)}
                        disabled={busyId === t.id}
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
