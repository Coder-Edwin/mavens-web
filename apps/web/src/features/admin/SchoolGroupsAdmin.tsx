import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  schoolGroupsApi,
  SCHOOL_GROUP_STATUSES,
  SCHOOL_GROUP_STATUS_LABEL,
  type SchoolGroup,
  type SchoolGroupInput,
  type SchoolGroupStatus
} from '@/lib/school-groups';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: SchoolGroupInput = {
  institutionName: '',
  address: '',
  coordinatorName: '',
  coordinatorPhone: '',
  coordinatorEmail: '',
  status: 'PROSPECT',
  notes: ''
};

function statusChipClass(s: SchoolGroupStatus): 'paid' | 'overdue' | 'pending' {
  if (s === 'ACTIVE') return 'paid';
  if (s === 'INACTIVE') return 'overdue';
  return 'pending';
}

export function SchoolGroupsAdmin() {
  const [groups, setGroups] = useState<SchoolGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SchoolGroupStatus | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, '' = new
  const [form, setForm] = useState<SchoolGroupInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh(next: SchoolGroupStatus | 'ALL' = filter) {
    try {
      setGroups(await schoolGroupsApi.list(next === 'ALL' ? undefined : next));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load school groups.');
    }
  }

  useEffect(() => {
    refresh('ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(next: SchoolGroupStatus | 'ALL') {
    setFilter(next);
    setGroups(null);
    refresh(next);
  }

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }

  function startEdit(g: SchoolGroup) {
    setForm({
      institutionName: g.institutionName,
      address: g.address ?? '',
      coordinatorName: g.coordinatorName ?? '',
      coordinatorPhone: g.coordinatorPhone ?? '',
      coordinatorEmail: g.coordinatorEmail ?? '',
      agreedGroupSize: g.agreedGroupSize ?? undefined,
      status: g.status,
      notes: g.notes ?? ''
    });
    setEditingId(g.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: SchoolGroupInput = {
      institutionName: form.institutionName.trim(),
      address: form.address?.trim() || undefined,
      coordinatorName: form.coordinatorName?.trim() || undefined,
      coordinatorPhone: form.coordinatorPhone?.trim() || undefined,
      coordinatorEmail: form.coordinatorEmail?.trim() || undefined,
      agreedGroupSize: form.agreedGroupSize || undefined,
      status: form.status,
      notes: form.notes?.trim() || undefined
    };
    try {
      if (editingId) {
        await schoolGroupsApi.update(editingId, payload);
      } else {
        await schoolGroupsApi.create(payload);
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the school group.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(g: SchoolGroup) {
    if (!window.confirm(`Delete “${g.institutionName}”? This cannot be undone.`)) return;
    setBusyId(g.id);
    setError(null);
    try {
      await schoolGroupsApi.remove(g.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the school group.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Partner schools</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {(['ALL', ...SCHOOL_GROUP_STATUSES] as const).map((s) => (
              <button
                key={s}
                className={`child-tab ${filter === s ? 'active' : ''}`}
                onClick={() => changeFilter(s)}
              >
                {s === 'ALL' ? 'All' : SCHOOL_GROUP_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {editingId === null && <Button onClick={startNew}>New school group</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit school group' : 'New school group'}>
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="sg-name">
                Institution name
              </label>
              <input
                id="sg-name"
                style={inputStyle}
                value={form.institutionName}
                onChange={(e) => setForm((f) => ({ ...f, institutionName: e.target.value }))}
                required
              />

              <label style={labelStyle} htmlFor="sg-address">
                Address <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="sg-address"
                style={inputStyle}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sg-coord-name">
                    Coordinator name
                  </label>
                  <input
                    id="sg-coord-name"
                    style={inputStyle}
                    value={form.coordinatorName}
                    onChange={(e) => setForm((f) => ({ ...f, coordinatorName: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sg-coord-phone">
                    Coordinator phone
                  </label>
                  <input
                    id="sg-coord-phone"
                    style={inputStyle}
                    value={form.coordinatorPhone}
                    onChange={(e) => setForm((f) => ({ ...f, coordinatorPhone: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle} htmlFor="sg-coord-email">
                    Coordinator email
                  </label>
                  <input
                    id="sg-coord-email"
                    type="email"
                    style={inputStyle}
                    value={form.coordinatorEmail}
                    onChange={(e) => setForm((f) => ({ ...f, coordinatorEmail: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="sg-size">
                    Agreed group size
                  </label>
                  <input
                    id="sg-size"
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={form.agreedGroupSize ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        agreedGroupSize: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="sg-status">
                Status
              </label>
              <select
                id="sg-status"
                style={inputStyle}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as SchoolGroupStatus }))
                }
              >
                {SCHOOL_GROUP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SCHOOL_GROUP_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>

              <label style={labelStyle} htmlFor="sg-notes">
                Notes <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <textarea
                id="sg-notes"
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create school group'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="School groups">
        {!groups && <div style={mutedNote}>Loading…</div>}
        {groups && groups.length === 0 && (
          <div style={mutedNote}>
            No school groups {filter === 'ALL' ? 'yet' : `with status “${SCHOOL_GROUP_STATUS_LABEL[filter as SchoolGroupStatus]}”`}.
          </div>
        )}
        {groups && groups.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Coordinator</th>
                <th>Enrollments</th>
                <th>Size</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{g.institutionName}</div>
                    {g.address && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{g.address}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {g.coordinatorName || '—'}
                    {(g.coordinatorPhone || g.coordinatorEmail) && (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {g.coordinatorPhone}
                        {g.coordinatorPhone && g.coordinatorEmail ? ' · ' : ''}
                        {g.coordinatorEmail}
                      </div>
                    )}
                  </td>
                  <td className="mono">{g._count?.enrollments ?? 0}</td>
                  <td className="mono">{g.agreedGroupSize ?? '—'}</td>
                  <td>
                    <Chip status={statusChipClass(g.status)} label={SCHOOL_GROUP_STATUS_LABEL[g.status]} />
                  </td>
                  <td style={rowActions}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(g)}
                      style={{ marginRight: 6 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => remove(g)}
                      disabled={busyId === g.id}
                      style={{ color: 'var(--red)' }}
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
