import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  payoutsApi,
  payoutStatusChip,
  PAYOUT_STATUS_LABEL,
  type PayoutRun,
  type PayoutStatus
} from '@/lib/payouts';
import { formatKes } from '@/lib/rate-cards';
import { formatCrmDate } from '@/lib/enrollments';
import { coachName } from '@/lib/coaches';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PayoutsAdmin() {
  const [rows, setRows] = useState<PayoutRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PayoutStatus | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [gen, setGen] = useState({ periodStart: firstOfMonth(), periodEnd: today(), notes: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh(next: PayoutStatus | 'ALL' = filter) {
    try {
      setRows(await payoutsApi.list(next === 'ALL' ? undefined : next));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load payout runs.');
    }
  }

  useEffect(() => {
    refresh('ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(next: PayoutStatus | 'ALL') {
    setFilter(next);
    setRows(null);
    setExpandedId(null);
    refresh(next);
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    try {
      const full = await payoutsApi.get(id);
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...full } : r)) ?? prev);
    } catch {
      /* keep summary */
    }
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await payoutsApi.generate({
        periodStart: new Date(gen.periodStart).toISOString(),
        periodEnd: new Date(gen.periodEnd).toISOString(),
        notes: gen.notes.trim() || undefined
      });
      setShowForm(false);
      setGen({ periodStart: firstOfMonth(), periodEnd: today(), notes: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the payout run.');
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, fn: () => Promise<unknown>, reloadList = false) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      if (reloadList) {
        await refresh();
      } else {
        const full = await payoutsApi.get(id);
        setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...full } : r)) ?? prev);
        if (filter !== 'ALL') await refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the payout run.');
    } finally {
      setBusyId(null);
    }
  }

  function runTotal(run: PayoutRun): number {
    return (run.items ?? []).reduce((s, it) => s + Number(it.amount), 0);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Coach payouts</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>{' '}
            · <Link to="/app/coaches" style={{ color: 'var(--gold-soft)' }}>Coach rates</Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {(['ALL', 'DRAFT', 'APPROVED', 'PAID'] as const).map((s) => (
              <button
                key={s}
                className={`child-tab ${filter === s ? 'active' : ''}`}
                onClick={() => changeFilter(s)}
              >
                {s === 'ALL' ? 'All' : PAYOUT_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {!showForm && <Button onClick={() => setShowForm(true)}>Generate run</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="Generate a payout run">
            <form onSubmit={handleGenerate}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="po-start">
                    Period start
                  </label>
                  <input
                    id="po-start"
                    type="date"
                    style={inputStyle}
                    value={gen.periodStart}
                    onChange={(e) => setGen((g) => ({ ...g, periodStart: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="po-end">
                    Period end
                  </label>
                  <input
                    id="po-end"
                    type="date"
                    style={inputStyle}
                    value={gen.periodEnd}
                    onChange={(e) => setGen((g) => ({ ...g, periodEnd: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <label style={labelStyle} htmlFor="po-notes">
                Notes <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="po-notes"
                style={inputStyle}
                value={gen.notes}
                onChange={(e) => setGen((g) => ({ ...g, notes: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Generating…' : 'Generate'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Payout runs">
        {!rows && <div style={mutedNote}>Loading…</div>}
        {rows && rows.length === 0 && (
          <div style={mutedNote}>
            No payout runs {filter === 'ALL' ? 'yet' : `that are ${PAYOUT_STATUS_LABEL[filter as PayoutStatus]}`}.
          </div>
        )}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Coaches</th>
                <th>Total</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((run) => {
                const chip = payoutStatusChip(run.status);
                const expanded = expandedId === run.id;
                return (
                  <Fragment key={run.id}>
                    <tr>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formatCrmDate(run.periodStart)} → {formatCrmDate(run.periodEnd)}
                      </td>
                      <td className="mono">{run._count?.items ?? run.items?.length ?? 0}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {expanded && run.items ? formatKes(runTotal(run)) : '—'}
                      </td>
                      <td>
                        <Chip status={chip.cls} label={chip.label} />
                      </td>
                      <td style={rowActions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(run.id)}>
                          {expanded ? 'Hide' : 'Open'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--panel-alt)' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            {run.status === 'DRAFT' && (
                              <button
                                className="btn btn-gold btn-sm"
                                disabled={busyId === run.id}
                                onClick={() => act(run.id, () => payoutsApi.approve(run.id))}
                              >
                                Approve
                              </button>
                            )}
                            {run.status === 'APPROVED' && (
                              <button
                                className="btn btn-gold btn-sm"
                                disabled={busyId === run.id}
                                onClick={() => act(run.id, () => payoutsApi.markPaid(run.id))}
                              >
                                Mark paid
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => payoutsApi.exportCsv(run.id)}
                            >
                              Export CSV
                            </button>
                            {run.status === 'DRAFT' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--red)' }}
                                disabled={busyId === run.id}
                                onClick={() => {
                                  if (window.confirm('Delete this draft run?'))
                                    act(run.id, () => payoutsApi.remove(run.id), true);
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          {!run.items && <div style={mutedNote}>Loading…</div>}
                          {run.items && (
                            <table>
                              <thead>
                                <tr>
                                  <th>Coach</th>
                                  <th>Sessions</th>
                                  <th>Rate</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {run.items.map((it) => (
                                  <tr key={it.id}>
                                    <td style={{ fontSize: 13 }}>
                                      {it.coach ? coachName(it.coach) : it.coachId}
                                      {it.notes && (
                                        <div style={{ fontSize: 12, color: 'var(--red)' }}>{it.notes}</div>
                                      )}
                                    </td>
                                    <td className="mono">{it.sessionCount}</td>
                                    <td className="mono" style={{ fontSize: 12 }}>
                                      {formatKes(it.ratePerSession)}
                                    </td>
                                    <td className="mono" style={{ fontSize: 12 }}>
                                      {formatKes(it.amount)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
