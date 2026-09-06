import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { leadsApi, formatLeadDate, LEAD_STATUSES, type Lead, type LeadStatus } from '@/lib/leads';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
