import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  merchandiseApi,
  ordersApi,
  orderCustomerName,
  orderStatusChip,
  orderSummary,
  type MerchandiseItem,
  type MerchandiseItemInput,
  type Order,
  type OrderStatus
} from '@/lib/merchandise';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

type Tab = 'CATALOG' | 'ORDERS';

const EMPTY: MerchandiseItemInput = {
  name: '',
  description: '',
  price: 0,
  sizeOptions: '',
  stockQuantity: 0,
  imageUrl: ''
};

function money(v: string | number): string {
  return `KES ${Number(v).toLocaleString()}`;
}

export function MerchandiseAdmin() {
  const [tab, setTab] = useState<Tab>('CATALOG');
  const [items, setItems] = useState<MerchandiseItem[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, '' = new
  const [form, setForm] = useState<MerchandiseItemInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  async function refreshItems() {
    try {
      setItems(await merchandiseApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the catalog.');
    }
  }

  async function refreshOrders() {
    try {
      setOrders(await ordersApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load orders.');
    }
  }

  useEffect(() => {
    refreshItems();
    refreshOrders();
  }, []);

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }

  function startEdit(item: MerchandiseItem) {
    setForm({
      name: item.name,
      description: item.description ?? '',
      price: Number(item.price),
      sizeOptions: item.sizeOptions ?? '',
      stockQuantity: item.stockQuantity,
      imageUrl: item.imageUrl ?? '',
      isActive: item.isActive
    });
    setEditingId(item.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: MerchandiseItemInput = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      price: form.price,
      sizeOptions: form.sizeOptions?.trim() || undefined,
      stockQuantity: form.stockQuantity,
      imageUrl: form.imageUrl?.trim() || undefined,
      ...(editingId ? { isActive: form.isActive } : {})
    };
    try {
      if (editingId) await merchandiseApi.update(editingId, payload);
      else await merchandiseApi.create(payload);
      cancelEdit();
      await refreshItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  }

  async function setOrderStatus(id: string, status: OrderStatus) {
    setBusyOrderId(id);
    setError(null);
    try {
      await ordersApi.updateStatus(id, status);
      await refreshOrders();
      if (status === 'FULFILLED' || status === 'CANCELLED') await refreshItems(); // stock only changes on order create, but keep the catalog fresh
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this order.');
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Merchandise</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="child-tabs" style={{ marginBottom: 0 }}>
            {(['CATALOG', 'ORDERS'] as Tab[]).map((t) => (
              <button
                key={t}
                className={`child-tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'CATALOG' ? 'Catalog' : 'Orders'}
              </button>
            ))}
          </div>
          {tab === 'CATALOG' && editingId === null && <Button onClick={startNew}>New item</Button>}
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {tab === 'CATALOG' && (
        <>
          {editingId !== null && (
            <div style={{ marginBottom: 20 }}>
              <Panel title={editingId ? 'Edit item' : 'New item'}>
                <form onSubmit={handleSubmit}>
                  <label style={labelStyle} htmlFor="mi-name">
                    Name
                  </label>
                  <input
                    id="mi-name"
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle} htmlFor="mi-price">
                        Price <span style={{ opacity: 0.6 }}>— KES</span>
                      </label>
                      <input
                        id="mi-price"
                        type="number"
                        min={0}
                        step="0.01"
                        style={inputStyle}
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle} htmlFor="mi-stock">
                        Stock quantity
                      </label>
                      <input
                        id="mi-stock"
                        type="number"
                        min={0}
                        style={inputStyle}
                        value={form.stockQuantity}
                        onChange={(e) => setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) }))}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle} htmlFor="mi-sizes">
                        Sizes <span style={{ opacity: 0.6 }}>— comma-separated</span>
                      </label>
                      <input
                        id="mi-sizes"
                        placeholder="S,M,L,XL"
                        style={inputStyle}
                        value={form.sizeOptions}
                        onChange={(e) => setForm((f) => ({ ...f, sizeOptions: e.target.value }))}
                      />
                    </div>
                  </div>

                  <label style={labelStyle} htmlFor="mi-image">
                    Image URL <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="mi-image"
                    style={inputStyle}
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  />

                  <label style={labelStyle} htmlFor="mi-description">
                    Description <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <textarea
                    id="mi-description"
                    style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />

                  {editingId && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <input
                        type="checkbox"
                        checked={form.isActive ?? true}
                        onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      />
                      <span style={labelStyle}>Active — visible in the parent store</span>
                    </label>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button type="submit" className="btn btn-gold" disabled={saving}>
                      {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create item'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  </div>
                </form>
              </Panel>
            </div>
          )}

          <Panel title="Catalog">
            {!items && <div style={mutedNote}>Loading…</div>}
            {items && items.length === 0 && (
              <div style={mutedNote}>No merchandise yet. Use “New item” to add the first one.</div>
            )}
            {items && items.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td className="mono">{money(item.price)}</td>
                      <td className="mono">{item.stockQuantity}</td>
                      <td>
                        <Chip
                          status={!item.isActive ? 'overdue' : item.stockQuantity > 0 ? 'paid' : 'pending'}
                          label={!item.isActive ? 'Inactive' : item.stockQuantity > 0 ? 'Active' : 'Out of stock'}
                        />
                      </td>
                      <td style={rowActions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}>
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
      )}

      {tab === 'ORDERS' && (
        <Panel title="Orders">
          {!orders && <div style={mutedNote}>Loading…</div>}
          {orders && orders.length === 0 && <div style={mutedNote}>No orders yet.</div>}
          {orders && orders.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const chip = orderStatusChip(o.status);
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{orderCustomerName(o)}</td>
                      <td style={{ fontSize: 13 }}>{orderSummary(o)}</td>
                      <td className="mono">{money(o.totalAmount)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{o.createdAt.slice(0, 10)}</td>
                      <td>
                        <Chip status={chip.cls} label={chip.label} />
                      </td>
                      <td style={rowActions}>
                        {o.status === 'PENDING' && (
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn-gold btn-sm"
                              disabled={busyOrderId === o.id}
                              onClick={() => setOrderStatus(o.id, 'FULFILLED')}
                            >
                              Fulfill
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--red)' }}
                              disabled={busyOrderId === o.id}
                              onClick={() => setOrderStatus(o.id, 'CANCELLED')}
                            >
                              Cancel
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}
    </>
  );
}
