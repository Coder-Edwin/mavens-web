import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  invoicesApi,
  invoiceStatusChip,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  PAYMENT_METHODS,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod
} from '@/lib/invoices';
import { formatKes } from '@/lib/rate-cards';
import { enrollmentsApi, formatCrmDate, type Enrollment } from '@/lib/enrollments';
import { schoolGroupsApi, type SchoolGroup } from '@/lib/school-groups';
import { studentName } from '@/lib/students';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InvoicesAdmin() {
  const [rows, setRows] = useState<Invoice[] | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [groups, setGroups] = useState<SchoolGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'enrollment' | 'school-group'>('enrollment');
  const [gen, setGen] = useState({ id: '', periodStart: firstOfMonth(), periodEnd: today(), notes: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pay, setPay] = useState({ amount: '', method: 'MPESA' as PaymentMethod, reference: '' });

  async function refresh(next: InvoiceStatus | 'ALL' = filter) {
    try {
      setRows(await invoicesApi.list(next === 'ALL' ? {} : { status: next }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load invoices.');
    }
  }

  useEffect(() => {
    refresh('ALL');
    Promise.all([enrollmentsApi.list(), schoolGroupsApi.list()])
      .then(([e, g]) => {
        setEnrollments(e);
        setGroups(g);
      })
      .catch(() => {
        /* pickers stay empty */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(next: InvoiceStatus | 'ALL') {
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
    setPay({ amount: '', method: 'MPESA', reference: '' });
    try {
      const full = await invoicesApi.get(id);
      setRows((prev) => prev?.map((r) => (r.id === id ? full : r)) ?? prev);
    } catch {
      /* keep summary */
    }
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'enrollment') {
        await invoicesApi.generateForEnrollment({
          enrollmentId: gen.id,
          periodStart: new Date(gen.periodStart).toISOString(),
          periodEnd: new Date(gen.periodEnd).toISOString(),
          notes: gen.notes.trim() || undefined
        });
      } else {
        await invoicesApi.generateForSchoolGroup({
          schoolGroupId: gen.id,
          periodStart: new Date(gen.periodStart).toISOString(),
          periodEnd: new Date(gen.periodEnd).toISOString(),
          notes: gen.notes.trim() || undefined
        });
      }
      setShowForm(false);
      setGen({ id: '', periodStart: firstOfMonth(), periodEnd: today(), notes: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the invoice.');
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      const full = await invoicesApi.get(id);
      setRows((prev) => prev?.map((r) => (r.id === id ? full : r)) ?? prev);
      if (filter !== 'ALL') await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the invoice.');
    } finally {
      setBusyId(null);
    }
  }

  async function submitPayment(inv: Invoice) {
    const amount = Number(pay.amount);
    if (!amount || amount <= 0) {
      setError('Enter a payment amount.');
      return;
    }
    await act(inv.id, () =>
      invoicesApi.recordPayment(inv.id, {
        amount,
        method: pay.method,
        reference: pay.reference.trim() || undefined
      })
    );
    setPay({ amount: '', method: 'MPESA', reference: '' });
  }

  function billedTo(inv: Invoice): string {
    if (inv.enrollment) return studentName(inv.enrollment.student);
    if (inv.schoolGroup) return inv.schoolGroup.institutionName;
    return '—';
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Invoices</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>{' '}
            · <Link to="/app/rate-cards" style={{ color: 'var(--gold-soft)' }}>Rate cards</Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {(['ALL', ...INVOICE_STATUSES] as const).map((s) => (
              <button
                key={s}
                className={`child-tab ${filter === s ? 'active' : ''}`}
                onClick={() => changeFilter(s)}
              >
                {s === 'ALL' ? 'All' : INVOICE_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => invoicesApi.exportCsv()}>
            Export CSV
          </button>
          {!showForm && <Button onClick={() => setShowForm(true)}>Generate invoice</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="Generate an invoice">
            <div className="child-tabs" style={{ marginBottom: 12 }}>
              <button
                className={`child-tab ${mode === 'enrollment' ? 'active' : ''}`}
                onClick={() => {
                  setMode('enrollment');
                  setGen((g) => ({ ...g, id: '' }));
                }}
              >
                For an enrollment
              </button>
              <button
                className={`child-tab ${mode === 'school-group' ? 'active' : ''}`}
                onClick={() => {
                  setMode('school-group');
                  setGen((g) => ({ ...g, id: '' }));
                }}
              >
                For a school group
              </button>
            </div>
            <form onSubmit={handleGenerate}>
              <label style={labelStyle} htmlFor="iv-target">
                {mode === 'enrollment' ? 'Enrollment' : 'School group'}
              </label>
              <select
                id="iv-target"
                style={inputStyle}
                value={gen.id}
                onChange={(e) => setGen((g) => ({ ...g, id: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {mode === 'enrollment'
                  ? enrollments.map((en) => (
                      <option key={en.id} value={en.id}>
                        {en.student ? `${en.student.firstName} ${en.student.lastName}` : en.id} ·{' '}
                        {en.deliveryType}
                      </option>
                    ))
                  : groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.institutionName}
                      </option>
                    ))}
              </select>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="iv-start">
                    Period start
                  </label>
                  <input
                    id="iv-start"
                    type="date"
                    style={inputStyle}
                    value={gen.periodStart}
                    onChange={(e) => setGen((g) => ({ ...g, periodStart: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="iv-end">
                    Period end
                  </label>
                  <input
                    id="iv-end"
                    type="date"
                    style={inputStyle}
                    value={gen.periodEnd}
                    onChange={(e) => setGen((g) => ({ ...g, periodEnd: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="iv-notes">
                Notes <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="iv-notes"
                style={inputStyle}
                value={gen.notes}
                onChange={(e) => setGen((g) => ({ ...g, notes: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving || !gen.id}>
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

      <Panel title="Invoices">
        {!rows && <div style={mutedNote}>Loading…</div>}
        {rows && rows.length === 0 && (
          <div style={mutedNote}>
            No invoices {filter === 'ALL' ? 'yet' : `that are ${INVOICE_STATUS_LABEL[filter as InvoiceStatus]}`}.
          </div>
        )}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Billed to</th>
                <th>Period</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const chip = invoiceStatusChip(inv.status);
                const expanded = expandedId === inv.id;
                return (
                  <Fragment key={inv.id}>
                    <tr>
                      <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                        {inv.number}
                      </td>
                      <td style={{ fontSize: 13 }}>{billedTo(inv)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formatCrmDate(inv.periodStart)} → {formatCrmDate(inv.periodEnd)}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formatKes(inv.total, inv.currency)}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formatKes(inv.amountPaid, inv.currency)}
                      </td>
                      <td>
                        <Chip status={chip.cls} label={chip.label} />
                      </td>
                      <td style={rowActions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(inv.id)}>
                          {expanded ? 'Hide' : 'Open'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--panel-alt)' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            {inv.status === 'DRAFT' && (
                              <button
                                className="btn btn-gold btn-sm"
                                disabled={busyId === inv.id}
                                onClick={() => act(inv.id, () => invoicesApi.issue(inv.id))}
                              >
                                Issue
                              </button>
                            )}
                            {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--red)' }}
                                disabled={busyId === inv.id}
                                onClick={() => {
                                  if (window.confirm(`Void ${inv.number}?`))
                                    act(inv.id, () => invoicesApi.voidInvoice(inv.id));
                                }}
                              >
                                Void
                              </button>
                            )}
                            {inv.status === 'DRAFT' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--red)' }}
                                disabled={busyId === inv.id}
                                onClick={() => {
                                  if (window.confirm(`Delete draft ${inv.number}?`))
                                    act(inv.id, () => invoicesApi.remove(inv.id)).then(() =>
                                      changeFilter(filter)
                                    );
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>

                          <div style={{ ...labelStyle, marginBottom: 6 }}>Lines</div>
                          {!inv.lines && <div style={mutedNote}>Loading…</div>}
                          {inv.lines && (
                            <table>
                              <tbody>
                                {inv.lines.map((l) => (
                                  <tr key={l.id}>
                                    <td style={{ fontSize: 12 }}>{l.description}</td>
                                    <td className="mono" style={{ fontSize: 12, textAlign: 'right' }}>
                                      {l.quantity} × {formatKes(l.unitAmount, inv.currency)}
                                    </td>
                                    <td className="mono" style={{ fontSize: 12, textAlign: 'right' }}>
                                      {formatKes(l.amount, inv.currency)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          <div style={{ ...labelStyle, margin: '12px 0 6px' }}>Payments</div>
                          {inv.payments && inv.payments.length === 0 && (
                            <div style={mutedNote}>None recorded.</div>
                          )}
                          {inv.payments && inv.payments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {inv.payments.map((p) => (
                                <div key={p.id} className="mono" style={{ fontSize: 12 }}>
                                  {formatCrmDate(p.paidAt)} · {formatKes(p.amount, inv.currency)} · {p.method}
                                  {p.reference ? ` · ${p.reference}` : ''}
                                </div>
                              ))}
                            </div>
                          )}

                          {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'flex-end',
                                marginTop: 10,
                                flexWrap: 'wrap'
                              }}
                            >
                              <div>
                                <label style={labelStyle} htmlFor={`pa-${inv.id}`}>
                                  Record payment
                                </label>
                                <input
                                  id={`pa-${inv.id}`}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="Amount"
                                  style={{ ...inputStyle, width: 140, margin: 0 }}
                                  value={pay.amount}
                                  onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))}
                                />
                              </div>
                              <select
                                aria-label="Payment method"
                                style={{ ...inputStyle, width: 'auto', margin: 0 }}
                                value={pay.method}
                                onChange={(e) =>
                                  setPay((p) => ({ ...p, method: e.target.value as PaymentMethod }))
                                }
                              >
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              <input
                                aria-label="Payment reference"
                                placeholder="Reference"
                                style={{ ...inputStyle, width: 160, margin: 0 }}
                                value={pay.reference}
                                onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))}
                              />
                              <button
                                className="btn btn-gold btn-sm"
                                disabled={busyId === inv.id}
                                onClick={() => submitPayment(inv)}
                              >
                                Add
                              </button>
                            </div>
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
