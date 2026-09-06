import { useEffect, useState } from 'react';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  membershipApi,
  isMembershipCurrent,
  formatMembershipDate,
  type Membership
} from '@/lib/membership';

/**
 * Yearly club membership status + pay button for one child. Sits alongside
 * the monthly class-subscription panel on the parent dashboard.
 */
export function MembershipPanel({
  studentId,
  childName,
  phoneNumber
}: {
  studentId: string;
  childName: string;
  phoneNumber: string;
}) {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined);
  const [state, setState] = useState<'idle' | 'sending'>('idle');
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function load() {
    try {
      setMembership(await membershipApi.forStudent(studentId));
    } catch (err) {
      setMembership(null);
      setMessage({
        text: err instanceof ApiError ? err.message : 'Could not load membership status.',
        tone: 'error'
      });
    }
  }

  useEffect(() => {
    setMembership(undefined);
    setMessage(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handlePay() {
    setState('sending');
    setMessage(null);
    try {
      const res = await membershipApi.pay(studentId, phoneNumber);
      setMessage({ text: res.message, tone: 'ok' });
      await load();
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : 'Could not start the membership payment.',
        tone: 'error'
      });
    } finally {
      setState('idle');
    }
  }

  const current = isMembershipCurrent(membership ?? null);
  const fee = membership?.plan?.amount;

  return (
    <Panel title={`${childName}'s Club Membership`}>
      {membership === undefined ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <div className="sub-status">
          <div className="sub-status-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Chip
                status={current ? 'paid' : 'overdue'}
                label={current ? 'Member' : membership?.status === 'PENDING' ? 'Payment pending' : 'Not a member'}
              />
              {fee && <span className="amt">KES {Number(fee).toLocaleString()}/yr</span>}
            </div>
            <div className="due">
              {current && membership
                ? `Valid until ${formatMembershipDate(membership.periodEnd)}`
                : 'The yearly membership fee is separate from monthly class fees.'}
            </div>
          </div>
          <button className="btn btn-gold" disabled={state === 'sending'} onClick={handlePay}>
            {state === 'sending' ? 'Sending…' : current ? 'Renew membership' : 'Pay membership'}
          </button>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            color: message.tone === 'error' ? '#E88376' : 'var(--leaf)'
          }}
        >
          {message.text}
        </div>
      )}
    </Panel>
  );
}
