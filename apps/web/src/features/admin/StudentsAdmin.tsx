import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { studentsApi, studentName, type CreateStudentResult, type StudentInput, type StudentRecord } from '@/lib/students';
import { coachesApi, coachName, type Coach } from '@/lib/coaches';
import { LEVEL_LABEL, type StudentLevel } from '@/lib/enrollments';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: StudentInput = {
  email: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  coachId: '',
  homeAddress: '',
  priorExperience: ''
};

function formatDob(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

export function StudentsAdmin() {
  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, '' = new
  const [form, setForm] = useState<StudentInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreateStudentResult | null>(null);

  async function refresh() {
    try {
      setStudents(await studentsApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load students.');
    }
  }

  useEffect(() => {
    refresh();
    coachesApi.list().then(setCoaches).catch(() => undefined);
  }, []);

  function startNew() {
    setForm(EMPTY);
    setCreated(null);
    setEditingId('');
  }

  function startEdit(s: StudentRecord) {
    setForm({
      email: s.user?.email ?? '',
      firstName: s.firstName,
      lastName: s.lastName,
      dateOfBirth: s.dateOfBirth?.slice(0, 10) ?? '',
      coachId: '',
      homeAddress: s.homeAddress ?? '',
      priorExperience: s.priorExperience ?? ''
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
    try {
      if (editingId) {
        await studentsApi.update(editingId, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          homeAddress: form.homeAddress?.trim() || undefined,
          priorExperience: form.priorExperience?.trim() || undefined
        });
      } else {
        const result = await studentsApi.create({
          email: form.email.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          coachId: form.coachId || undefined,
          homeAddress: form.homeAddress?.trim() || undefined,
          priorExperience: form.priorExperience?.trim() || undefined
        });
        setCreated(result);
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the student.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Students</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {editingId === null && <Button onClick={startNew}>New student</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {created && (
        <div className="alert-card" style={{ marginBottom: 16, borderColor: 'var(--gold-soft)' }}>
          <b>Student added —</b> {studentName(created.student)} can sign in with a temporary password.
          <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>
            Temp password: <b>{created.tempPassword}</b>
          </div>
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit student' : 'New student'}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="st-first">
                    First name
                  </label>
                  <input
                    id="st-first"
                    style={inputStyle}
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="st-last">
                    Last name
                  </label>
                  <input
                    id="st-last"
                    style={inputStyle}
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="st-email">
                Login email {editingId && <span style={{ opacity: 0.6 }}>— fixed after creation</span>}
              </label>
              <input
                id="st-email"
                type="email"
                style={{ ...inputStyle, opacity: editingId ? 0.6 : 1 }}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                disabled={!!editingId}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="st-dob">
                    Date of birth <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="st-dob"
                    type="date"
                    style={inputStyle}
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                </div>
                {!editingId && (
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle} htmlFor="st-coach">
                      Assign a coach <span style={{ opacity: 0.6 }}>— optional</span>
                    </label>
                    <select
                      id="st-coach"
                      style={inputStyle}
                      value={form.coachId}
                      onChange={(e) => setForm((f) => ({ ...f, coachId: e.target.value }))}
                    >
                      <option value="">No coach yet</option>
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {coachName(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <label style={labelStyle} htmlFor="st-address">
                Home address <span style={{ opacity: 0.6 }}>— for HOME-delivery lessons, optional</span>
              </label>
              <input
                id="st-address"
                style={inputStyle}
                value={form.homeAddress}
                onChange={(e) => setForm((f) => ({ ...f, homeAddress: e.target.value }))}
              />

              <label style={labelStyle} htmlFor="st-experience">
                Prior experience <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="st-experience"
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={form.priorExperience}
                onChange={(e) => setForm((f) => ({ ...f, priorExperience: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create student'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Students">
        {!students && <div style={mutedNote}>Loading…</div>}
        {students && students.length === 0 && (
          <div style={mutedNote}>No students yet. Use “New student” to add the first one.</div>
        )}
        {students && students.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Login email</th>
                <th>Level</th>
                <th>Date of birth</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{studentName(s)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {s.user?.email ?? '—'}
                  </td>
                  <td>
                    {s.level ? (
                      <Chip status="paid" label={LEVEL_LABEL[s.level as StudentLevel]} />
                    ) : (
                      <span style={mutedNote}>Unplaced</span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatDob(s.dateOfBirth)}
                  </td>
                  <td style={rowActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(s)}>
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
