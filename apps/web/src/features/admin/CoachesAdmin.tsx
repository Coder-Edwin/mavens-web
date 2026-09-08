import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  coachesApi,
  coachName,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_LABEL,
  type Coach,
  type CoachInput,
  type CreateCoachResult,
  type EmploymentType
} from '@/lib/coaches';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: CoachInput = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  specialty: '',
  bio: '',
  skills: '',
  employmentType: 'STAFF',
  sessionRate: undefined
};

export function CoachesAdmin() {
  const [coaches, setCoaches] = useState<Coach[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, '' = new
  const [form, setForm] = useState<CoachInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreateCoachResult | null>(null);

  async function refresh() {
    try {
      setCoaches(await coachesApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load coaches.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startNew() {
    setForm(EMPTY);
    setCreated(null);
    setEditingId('');
  }

  function startEdit(c: Coach) {
    setForm({
      email: c.user?.email ?? '',
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      phone: c.phone ?? '',
      specialty: c.specialty ?? '',
      bio: c.bio ?? '',
      skills: c.skills ?? '',
      employmentType: c.employmentType,
      sessionRate: c.sessionRate != null ? Number(c.sessionRate) : undefined
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
    try {
      if (editingId) {
        await coachesApi.update(editingId, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone?.trim() || undefined,
          specialty: form.specialty?.trim() || undefined,
          bio: form.bio?.trim() || undefined,
          skills: form.skills?.trim() || undefined,
          employmentType: form.employmentType,
          sessionRate: form.sessionRate ?? undefined
        });
      } else {
        const result = await coachesApi.create({
          email: form.email.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone?.trim() || undefined,
          specialty: form.specialty?.trim() || undefined,
          bio: form.bio?.trim() || undefined,
          skills: form.skills?.trim() || undefined,
          employmentType: form.employmentType
        });
        setCreated(result);
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the coach.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Coaches</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {editingId === null && <Button onClick={startNew}>New coach</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {created && (
        <div className="alert-card" style={{ marginBottom: 16, borderColor: 'var(--gold-soft)' }}>
          <b>Coach added —</b> {coachName(created.coach)} can sign in with a temporary password.
          <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>
            Temp password: <b>{created.tempPassword}</b>
          </div>
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit coach' : 'New coach'}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-first">
                    First name
                  </label>
                  <input
                    id="co-first"
                    style={inputStyle}
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-last">
                    Last name
                  </label>
                  <input
                    id="co-last"
                    style={inputStyle}
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="co-email">
                Login email {editingId && <span style={{ opacity: 0.6 }}>— fixed after creation</span>}
              </label>
              <input
                id="co-email"
                type="email"
                style={{ ...inputStyle, opacity: editingId ? 0.6 : 1 }}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                disabled={!!editingId}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-phone">
                    Phone
                  </label>
                  <input
                    id="co-phone"
                    style={inputStyle}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-employment">
                    Employment
                  </label>
                  <select
                    id="co-employment"
                    style={inputStyle}
                    value={form.employmentType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, employmentType: e.target.value as EmploymentType }))
                    }
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EMPLOYMENT_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="co-rate">
                    Session rate <span style={{ opacity: 0.6 }}>— KES, for payouts</span>
                  </label>
                  <input
                    id="co-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    style={inputStyle}
                    value={form.sessionRate ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sessionRate: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="co-specialty">
                Specialty <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="co-specialty"
                style={inputStyle}
                value={form.specialty}
                onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
              />

              <label style={labelStyle} htmlFor="co-skills">
                Skills <span style={{ opacity: 0.6 }}>— comma-separated</span>
              </label>
              <input
                id="co-skills"
                style={inputStyle}
                value={form.skills}
                onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              />

              <label style={labelStyle} htmlFor="co-bio">
                Bio <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="co-bio"
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create coach'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Coaching team">
        {!coaches && <div style={mutedNote}>Loading…</div>}
        {coaches && coaches.length === 0 && (
          <div style={mutedNote}>No coaches yet. Use “New coach” to add the first one.</div>
        )}
        {coaches && coaches.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Specialty</th>
                <th>Employment</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{coachName(c)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {c.user?.email}
                    {c.phone && (
                      <div style={{ color: 'var(--muted)', marginTop: 2 }}>{c.phone}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{c.specialty || '—'}</td>
                  <td>
                    <Chip
                      status={c.employmentType === 'STAFF' ? 'paid' : 'pending'}
                      label={EMPLOYMENT_LABEL[c.employmentType]}
                    />
                  </td>
                  <td style={rowActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>
                      Edit
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
