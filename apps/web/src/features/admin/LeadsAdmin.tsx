import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  leadsApi,
  formatLeadDate,
  LEAD_STATUSES,
  type ConvertLeadInput,
  type ConvertLeadResult,
  type Lead,
  type LeadStatus
} from '@/lib/leads';
import { schoolGroupsApi, type SchoolGroup } from '@/lib/school-groups';
import { inputStyle, labelStyle } from './crmStyles';

function splitChildName(name: string | null): { first: string; last: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

const EMPTY_CONVERT: ConvertLeadInput = {
  studentFirstName: '',
  studentLastName: '',
  studentEmail: '',
  linkParent: true,
  createEnrollment: false,
  deliveryType: 'CENTER',
  schedulePlacement: true
};

// Map the four lead states onto the three chip colours tokens.css defines.
function statusChip(s: LeadStatus): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'NEW') return { cls: 'pending', label: 'New' };
  if (s === 'ENROLLED') return { cls: 'paid', label: 'Enrolled' };
  if (s === 'ARCHIVED') return { cls: 'overdue', label: 'Archived' };
  return { cls: 'paid', label: 'Contacted' };
}

export function LeadsAdmin() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertLeadInput>(EMPTY_CONVERT);
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<ConvertLeadResult | null>(null);
  const [groups, setGroups] = useState<SchoolGroup[]>([]);

  async function refresh(next: LeadStatus | 'ALL' = filter) {
    try {
      setLeads(await leadsApi.list(next === 'ALL' ? undefined : next));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load leads.');
    }
  }

  useEffect(() => {
    refresh('ALL');
    schoolGroupsApi
      .list()
      .then(setGroups)
      .catch(() => {
        /* school-group picker stays empty */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startConvert(lead: Lead) {
    const { first, last } = splitChildName(lead.childName);
    setConvertForm({ ...EMPTY_CONVERT, studentFirstName: first, studentLastName: last });
    setConvertResult(null);
    setConvertingId(lead.id);
  }

  function cancelConvert() {
    setConvertingId(null);
    setConvertForm(EMPTY_CONVERT);
  }

  async function submitConvert(e: FormEvent) {
    e.preventDefault();
    if (!convertingId) return;
    setConverting(true);
    setError(null);
    const f = convertForm;
    const payload: ConvertLeadInput = {
      studentFirstName: f.studentFirstName.trim(),
      studentLastName: f.studentLastName.trim(),
      studentEmail: f.studentEmail.trim(),
      linkParent: f.linkParent,
      createEnrollment: f.createEnrollment,
      deliveryType: f.createEnrollment ? f.deliveryType : undefined,
      schoolGroupId:
        f.createEnrollment && f.deliveryType === 'SCHOOL_GROUP' ? f.schoolGroupId : undefined,
      schedulePlacement: f.schedulePlacement
    };
    try {
      const result = await leadsApi.convert(convertingId, payload);
      setConvertResult(result);
      setConvertingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not convert the lead.');
    } finally {
      setConverting(false);
    }
  }

  function changeFilter(next: LeadStatus | 'ALL') {
    setFilter(next);
    setLeads(null);
    refresh(next);
  }

  async function setStatus(lead: Lead, status: LeadStatus) {
    setBusyId(lead.id);
    setError(null);
    try {
      await leadsApi.update(lead.id, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the lead.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(lead: Lead) {
    if (!window.confirm(`Delete the enquiry from ${lead.parentName}? This cannot be undone.`)) return;
    setBusyId(lead.id);
    setError(null);
    try {
      await leadsApi.remove(lead.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the lead.');
    } finally {
      setBusyId(null);
    }
  }

  const newCount = leads?.filter((l) => l.status === 'NEW').length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
            {newCount > 0 && <> · {newCount} awaiting first contact</>}
          </div>
        </div>
        <div className="child-tabs" style={{ marginBottom: 0 }}>
          {(['ALL', ...LEAD_STATUSES] as const).map((s) => (
            <button
              key={s}
              className={`child-tab ${filter === s ? 'active' : ''}`}
              onClick={() => changeFilter(s)}
            >
              {s === 'ALL' ? 'All' : statusChip(s).label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {convertResult && (
        <div className="alert-card" style={{ marginBottom: 16, borderColor: 'var(--gold-soft)' }}>
          <b>Converted —</b> {convertResult.student.firstName} {convertResult.student.lastName} now has a
          student record.
          <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>
            Student temp password: <b>{convertResult.studentTempPassword}</b>
            {convertResult.parentTempPassword && (
              <>
                {' · '}Parent temp password: <b>{convertResult.parentTempPassword}</b>
              </>
            )}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {convertResult.enrollment ? 'Enrollment opened. ' : ''}
            {convertResult.placement ? 'Placement assessment scheduled.' : ''}
          </div>
        </div>
      )}

      {convertingId && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="Convert lead to student">
            <form onSubmit={submitConvert}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="cv-first">
                    Student first name
                  </label>
                  <input
                    id="cv-first"
                    style={inputStyle}
                    value={convertForm.studentFirstName}
                    onChange={(e) =>
                      setConvertForm((f) => ({ ...f, studentFirstName: e.target.value }))
                    }
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="cv-last">
                    Student last name
                  </label>
                  <input
                    id="cv-last"
                    style={inputStyle}
                    value={convertForm.studentLastName}
                    onChange={(e) =>
                      setConvertForm((f) => ({ ...f, studentLastName: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="cv-email">
                Student login email <span style={{ opacity: 0.6 }}>— must differ from the parent’s</span>
              </label>
              <input
                id="cv-email"
                type="email"
                style={inputStyle}
                value={convertForm.studentEmail}
                onChange={(e) => setConvertForm((f) => ({ ...f, studentEmail: e.target.value }))}
                required
              />

              <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={convertForm.linkParent ?? true}
                  onChange={(e) => setConvertForm((f) => ({ ...f, linkParent: e.target.checked }))}
                />
                Create / link a parent account from the enquiry contact
              </label>

              <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={convertForm.schedulePlacement ?? false}
                  onChange={(e) =>
                    setConvertForm((f) => ({ ...f, schedulePlacement: e.target.checked }))
                  }
                />
                Schedule a placement assessment
              </label>

              <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={convertForm.createEnrollment ?? false}
                  onChange={(e) =>
                    setConvertForm((f) => ({ ...f, createEnrollment: e.target.checked }))
                  }
                />
                Open an enrollment now
              </label>

              {convertForm.createEnrollment && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle} htmlFor="cv-delivery">
                      Delivery
                    </label>
                    <select
                      id="cv-delivery"
                      style={inputStyle}
                      value={convertForm.deliveryType}
                      onChange={(e) =>
                        setConvertForm((f) => ({
                          ...f,
                          deliveryType: e.target.value as ConvertLeadInput['deliveryType']
                        }))
                      }
                    >
                      <option value="HOME">Home</option>
                      <option value="CENTER">Centre</option>
                      <option value="SCHOOL_GROUP">School group</option>
                    </select>
                  </div>
                  {convertForm.deliveryType === 'SCHOOL_GROUP' && (
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle} htmlFor="cv-group">
                        School group
                      </label>
                      <select
                        id="cv-group"
                        style={inputStyle}
                        value={convertForm.schoolGroupId ?? ''}
                        onChange={(e) =>
                          setConvertForm((f) => ({ ...f, schoolGroupId: e.target.value || undefined }))
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
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={converting}>
                  {converting ? 'Converting…' : 'Convert lead'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelConvert}
                  disabled={converting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Enquiries">
        {!leads && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
        )}
        {leads && leads.length === 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            No leads {filter === 'ALL' ? 'yet' : `with status “${statusChip(filter as LeadStatus).label}”`}.
          </div>
        )}
        {leads && leads.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>Contact</th>
                <th>Child</th>
                <th>Received</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const chip = statusChip(l.status);
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.parentName}</div>
                      {l.message && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--muted)',
                            marginTop: 3,
                            maxWidth: 320,
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {l.message}
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      <a href={`mailto:${l.email}`}>{l.email}</a>
                      <br />
                      <a href={`tel:${l.phone}`}>{l.phone}</a>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {l.childName || '—'}
                      {l.childAge != null && <span style={{ color: 'var(--muted)' }}> ({l.childAge})</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {formatLeadDate(l.createdAt)}
                    </td>
                    <td>
                      <Chip status={chip.cls} label={chip.label} />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <select
                        aria-label={`Set status for ${l.parentName}`}
                        value={l.status}
                        disabled={busyId === l.id}
                        onChange={(e) => setStatus(l, e.target.value as LeadStatus)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: 'var(--panel-alt)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          marginRight: 6
                        }}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusChip(s).label}
                          </option>
                        ))}
                      </select>
                      {l.status !== 'ENROLLED' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startConvert(l)}
                          disabled={busyId === l.id || converting}
                          style={{ marginRight: 6 }}
                        >
                          Convert
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => remove(l)}
                        disabled={busyId === l.id}
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
