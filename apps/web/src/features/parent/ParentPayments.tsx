import { useState } from 'react';
import { Panel } from '@/components/ui/Primitives';
import { ApiError, api } from '@/lib/api-client';
import { MembershipPanel } from '@/features/parent/MembershipPanel';
import { ChildTabs } from '@/features/parent/ChildTabs';
import { useChildren } from '@/features/parent/useChildren';
import { mutedNote } from '@/features/admin/crmStyles';

const fieldStyle: React.CSSProperties = {
  padding: '9px 11px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--panel-alt)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12.5
};

/// The parent "Payments" nav item's own destination — the subscription
/// M-Pesa STK push and the yearly membership fee, previously only reachable
/// bundled into the Overview page.
export function ParentPayments() {
  const { children, activeChildId, setActiveChildId, error } = useChildren();

  const [phoneNumber, setPhoneNumber] = useState('254708374149'); // sandbox test number, pre-filled for convenience
  const [payState, setPayState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [payMessage, setPayMessage] = useState<string | null>(null);

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

  const activeChild = children?.find((c) => c.id === activeChildId) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Payments</div>
          <div className="page-sub">Monthly coaching subscription and yearly club membership</div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!children ? (
        <div style={mutedNote}>Loading…</div>
      ) : children.length === 0 ? (
        <Panel title="No children linked yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            No students are linked to your account yet. Ask the club admin to link your child's profile to your
            parent account.
          </p>
        </Panel>
      ) : (
        <>
          <ChildTabs children={children} activeChildId={activeChildId} onSelect={setActiveChildId} />

          <div style={{ marginBottom: 16, marginTop: 16 }}>
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

          {activeChild && (
            <MembershipPanel
              key={activeChild.id}
              studentId={activeChild.id}
              childName={activeChild.firstName}
              phoneNumber={phoneNumber}
            />
          )}
        </>
      )}
    </>
  );
}
