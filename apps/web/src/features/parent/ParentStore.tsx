import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui/Primitives';
import { ApiError, api } from '@/lib/api-client';
import { mutedNote } from '@/features/admin/crmStyles';

interface MerchandiseItemSummary {
  id: string;
  name: string;
  price: string;
  sizeOptions: string | null;
  stockQuantity: number;
}

function money(v: string): string {
  return `KES ${Number(v).toLocaleString()}`;
}

/// The parent "Store" nav item's own destination — browse and buy club
/// merchandise, previously only reachable bundled into the Overview page.
/// An order isn't tied to a specific child, so no child selector here.
export function ParentStore() {
  const [items, setItems] = useState<MerchandiseItemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await api.get<MerchandiseItemSummary[]>('/merchandise'));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the store.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function buy(itemId: string) {
    setBusyId(itemId);
    setOrderMessage(null);
    try {
      await api.post('/orders', { items: [{ merchandiseItemId: itemId, quantity: 1 }] });
      setOrderMessage('Order placed!');
      await refresh(); // refreshes stock counts
    } catch (err) {
      setOrderMessage(err instanceof ApiError ? err.message : 'Could not place this order.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Store</div>
          <div className="page-sub">Club merchandise</div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!items ? (
        <div style={mutedNote}>Loading…</div>
      ) : (
        <Panel title="Club Store">
          {items.length === 0 ? (
            <div style={mutedNote}>Nothing in the store right now.</div>
          ) : (
            <div className="store-grid">
              {items.map((item) => (
                <div className="store-item" key={item.id}>
                  <div className="store-body">
                    <div className="store-name">{item.name}</div>
                    <div className="store-price">
                      {money(item.price)} · {item.stockQuantity} in stock
                    </div>
                    <button
                      className="btn btn-ghost store-buy"
                      disabled={item.stockQuantity === 0 || busyId === item.id}
                      onClick={() => buy(item.id)}
                    >
                      {item.stockQuantity === 0 ? 'Out of stock' : 'Buy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {orderMessage && (
            <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--gold-soft)' }}>
              {orderMessage}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
