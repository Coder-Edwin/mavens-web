import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  rateCardsApi,
  RATE_UNITS,
  RATE_UNIT_LABEL,
  formatKes,
  type RateCard,
  type RateCardInput,
  type RateUnit
} from '@/lib/rate-cards';
import {
  DELIVERY_TYPES,
  DELIVERY_LABEL,
  LEVEL_LABEL,
  STUDENT_LEVELS,
  formatCrmDate,
  type DeliveryType,
  type StudentLevel,
  type ClientType
} from '@/lib/enrollments';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: RateCardInput = {
  name: '',
  deliveryType: 'CENTER',
  unit: 'PER_SESSION',
  amount: 0,
  currency: 'KES',
  active: true
};

export function RateCardsAdmin() {
  const [cards, setCards] = useState<RateCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RateCardInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setCards(await rateCardsApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load rate cards.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }

  function startEdit(c: RateCard) {
    setForm({
      name: c.name,
      deliveryType: c.deliveryType,
      level: c.level,
      clientType: c.clientType,
      unit: c.unit,
      amount: Number(c.amount),
      currency: c.currency,
      active: c.active,
      effectiveFrom: c.effectiveFrom.slice(0, 10),
      effectiveTo: c.effectiveTo ? c.effectiveTo.slice(0, 10) : null,
      notes: c.notes ?? undefined
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
    const payload: RateCardInput = {
      name: form.name.trim(),
      deliveryType: form.deliveryType,
      level: form.level ?? null,
      clientType: form.clientType ?? null,
      unit: form.unit,
      amount: Number(form.amount),
      currency: (form.currency || 'KES').toUpperCase(),
      active: form.active,
      effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : undefined,
      effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
      notes: form.notes?.trim() || undefined
    };
    try {
      if (editingId) await rateCardsApi.update(editingId, payload);
      else await rateCardsApi.create(payload);
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the rate card.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: RateCard) {
    if (!window.confirm(`Delete “${c.name}”?`)) return;
    setBusyId(c.id);
    setError(null);
    try {
      await rateCardsApi.remove(c.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the rate card.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Rate cards</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>{' '}
            · <Link to="/app/invoices" style={{ color: 'var(--gold-soft)' }}>Invoices</Link>
          </div>
        </div>
        {editingId === null && <Button onClick={startNew}>New rate card</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit rate card' : 'New rate card'}>
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="rc-name">
                Name
              </label>
              <input
                id="rc-name"
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-delivery">
                    Delivery
                  </label>
                  <select
                    id="rc-delivery"
                    style={inputStyle}
                    value={form.deliveryType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, deliveryType: e.target.value as DeliveryType }))
                    }
                  >
                    {DELIVERY_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {DELIVERY_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-level">
                    Level <span style={{ opacity: 0.6 }}>— any</span>
                  </label>
                  <select
                    id="rc-level"
                    style={inputStyle}
                    value={form.level ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        level: (e.target.value || null) as StudentLevel | null
                      }))
                    }
                  >
                    <option value="">Any level</option>
                    {STUDENT_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABEL[l]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-client">
                    Client <span style={{ opacity: 0.6 }}>— any</span>
                  </label>
                  <select
                    id="rc-client"
                    style={inputStyle}
                    value={form.clientType ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        clientType: (e.target.value || null) as ClientType | null
                      }))
                    }
                  >
                    <option value="">Any client</option>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="INSTITUTION">Institution</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-unit">
                    Unit
                  </label>
                  <select
                    id="rc-unit"
                    style={inputStyle}
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as RateUnit }))}
                  >
                    {RATE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {RATE_UNIT_LABEL[u]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-amount">
                    Amount
                  </label>
                  <input
                    id="rc-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    style={inputStyle}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-currency">
                    Currency
                  </label>
                  <input
                    id="rc-currency"
                    style={inputStyle}
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-from">
                    Effective from <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="rc-from"
                    type="date"
                    style={inputStyle}
                    value={form.effectiveFrom ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, effectiveFrom: e.target.value || undefined }))
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="rc-to">
                    Effective to <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="rc-to"
                    type="date"
                    style={inputStyle}
                    value={form.effectiveTo ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, effectiveTo: e.target.value || null }))
                    }
                  />
                </div>
              </div>

              <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={form.active ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create rate card'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Rate cards">
        {!cards && <div style={mutedNote}>Loading…</div>}
        {cards && cards.length === 0 && (
          <div style={mutedNote}>No rate cards yet. Invoices need at least one matching card.</div>
        )}
        {cards && cards.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Applies to</th>
                <th>Rate</th>
                <th>Effective</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ fontSize: 13 }}>
                    {DELIVERY_LABEL[c.deliveryType]}
                    {c.level ? ` · ${LEVEL_LABEL[c.level]}` : ''}
                    {c.clientType ? ` · ${c.clientType === 'INSTITUTION' ? 'Institution' : 'Individual'}` : ''}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatKes(c.amount, c.currency)} {RATE_UNIT_LABEL[c.unit].toLowerCase()}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatCrmDate(c.effectiveFrom)}
                    {c.effectiveTo ? ` – ${formatCrmDate(c.effectiveTo)}` : ''}
                  </td>
                  <td>
                    <Chip status={c.active ? 'paid' : 'overdue'} label={c.active ? 'Active' : 'Inactive'} />
                  </td>
                  <td style={rowActions}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(c)}
                      style={{ marginRight: 6 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => remove(c)}
                      disabled={busyId === c.id}
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
