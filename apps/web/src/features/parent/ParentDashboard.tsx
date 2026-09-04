import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui/Primitives';
import { api, ApiError } from '@/lib/api-client';

interface ChildSummary {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
}

interface TournamentSummary {
  id: string;
  name: string;
  date: string;
  venue: string;
  feeAmount: string; // Prisma Decimal serializes as a string over JSON
  registeredCount: number;
  isFull: boolean;
}

interface MerchandiseItemSummary {
  id: string;
  name: string;
  price: string;
  sizeOptions: string | null;
  stockQuantity: number;
}

const fieldStyle: React.CSSProperties = {
  padding: '9px 11px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--panel-alt)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12.5
};

function formatKes(amount: string): string {
  return `KES ${Number(amount).toLocaleString()}`;
}

export function ParentDashboard() {
  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<TournamentSummary[] | null>(null);
  const [store, setStore] = useState<MerchandiseItemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [phoneNumber, setPhoneNumber] = useState('254708374149'); // sandbox test number, pre-filled for convenience
  const [payState, setPayState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [payMessage, setPayMessage] = useState<string | null>(null);

  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [childrenData, tournamentsData, storeData] = await Promise.all([
        api.get<ChildSummary[]>('/students'),
        api.get<TournamentSummary[]>('/tournaments'),
        api.get<MerchandiseItemSummary[]>('/merchandise')
      ]);
      setChildren(childrenData);
      setActiveChildId((prev) => prev ?? childrenData[0]?.id ?? null);
      setTournaments(tournamentsData);
      setStore(storeData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your dashboard.');
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePay() {
    if (!activeChildId) return;
    setPayState('sending');
    setPayMessage(null);
    try {
      const result = await api.post<{ message: string }>('/payments/mpesa/stk-push', {
        studentId: activeChildId,
        phoneNumber
      });
      setPayState('sent');
      setPayMessage(result.message);
    } catch (err) {
      setPayState('error');
      setPayMessage(err instanceof ApiError ? err.message : 'Could not start the payment.');
    }
  }

  async function handleRegister(tournamentId: string) {
    if (!activeChildId) return;
    setRegisterMessage(null);
    try {
      await api.post(`/tournaments/${tournamentId}/register`, { studentId: activeChildId });
      setRegisterMessage('Registered!');
      await loadAll();
    } catch (err) {
      setRegisterMessage(err instanceof ApiError ? err.message : 'Could not register.');
    }
  }

  async function handleBuy(itemId: string) {
    setOrderMessage(null);
    try {
      await api.post('/orders', { items: [{ merchandiseItemId: itemId, quantity: 1 }] });
      setOrderMessage('Order placed!');
      await loadAll(); // refreshes stock counts
    } catch (err) {
      setOrderMessage(err instanceof ApiError ? err.message : 'Could not place this order.');
    }
  }

  if (error) {
    return (
      <div className="panel" style={{ borderColor: 'var(--red)' }}>
        <div className="panel-title">Something went wrong</div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{error}</p>
      </div>
    );
  }

  if (!children || !tournaments || !store) {
    return <div className="page-sub">Loading your dashboard…</div>;
  }

  const activeChild = children.find((c) => c.id === activeChildId) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Family Overview</div>
        </div>
      </div>

      {children.length === 0 ? (
        <Panel title="No children linked yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            No students are linked to your account yet. Ask the club admin to link your child's profile to your parent
            account.
          </p>
        </Panel>
      ) : (
        <>
          <div className="child-tabs">
            {children.map((c) => (
              <div
                key={c.id}
                className={`child-tab ${c.id === activeChildId ? 'active' : ''}`}
                onClick={() => setActiveChildId(c.id)}
              >
                {c.firstName}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Panel title={`Pay ${activeChild?.firstName ?? ''}'s Subscription`}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', marginBottom: 6 }}>
                    M-PESA PHONE NUMBER
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    style={{ ...fieldStyle, width: 200 }}
                  />
                </div>
                <button className="btn btn-gold" disabled={payState === 'sending'} onClick={handlePay}>
                  {payState === 'sending' ? 'Sending…' : 'Pay with M-Pesa'}
                </button>
              </div>
              {payMessage && (
                <div
                  style={{
                    marginTop: 12,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    color: payState === 'error' ? '#E88376' : 'var(--leaf)'
                  }}
                >
                  {payMessage}
                  {payState === 'error' && (
                    <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                      (This usually means M-Pesa credentials aren't configured yet on the server — expected until
                      real Daraja credentials are added.)
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid-2">
            <Panel title="Upcoming Tournaments">
              {tournaments.length === 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                  No tournaments scheduled right now.
                </div>
              )}
              {tournaments.map((t) => (
                <div key={t.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 13 }}>
                    <b>{t.name}</b> — {new Date(t.date).toLocaleDateString()}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {t.venue} · {formatKes(t.feeAmount)} · {t.isFull ? 'FULL' : `${t.registeredCount} registered`}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8 }}
                    disabled={t.isFull}
                    onClick={() => handleRegister(t.id)}
                  >
                    {t.isFull ? 'Full' : `Register ${activeChild?.firstName ?? ''}`}
                  </button>
                </div>
              ))}
              {registerMessage && (
                <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--gold-soft)' }}>
                  {registerMessage}
                </div>
              )}
            </Panel>

            <Panel title="Club Store">
              <div className="store-grid" style={{ gridTemplateColumns: '1fr' }}>
                {store.map((item) => (
                  <div className="store-item" key={item.id}>
                    <div className="store-body">
                      <div className="store-name">{item.name}</div>
                      <div className="store-price">
                        {formatKes(item.price)} · {item.stockQuantity} in stock
                      </div>
                      <button
                        className="btn btn-ghost store-buy"
                        disabled={item.stockQuantity === 0}
                        onClick={() => handleBuy(item.id)}
                      >
                        {item.stockQuantity === 0 ? 'Out of stock' : 'Buy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {orderMessage && (
                <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--gold-soft)' }}>
                  {orderMessage}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
