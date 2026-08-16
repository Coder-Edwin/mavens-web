import { useState } from 'react';
import { Button } from '@/components/ui/Primitives';

type ModalStage = 'closed' | 'form' | 'sending' | 'success';

interface MpesaModalProps {
  stage: ModalStage;
  childName: string;
  amount: string;
  onClose: () => void;
  onSend: (phone: string) => void;
}

export function MpesaModal({ stage, childName, amount, onClose, onSend }: MpesaModalProps) {
  const [phone, setPhone] = useState('');

  if (stage === 'closed') return null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {stage === 'form' && (
          <>
            <div className="glyph-big">♛</div>
            <h3>Pay with M-Pesa</h3>
            <p>
              Enter the phone number to receive the STK push for {childName}'s August subscription — {amount}.
            </p>
            <input
              type="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button onClick={() => onSend(phone)}>Send Payment Request</Button>
            <div className="modal-close" onClick={onClose}>
              Cancel
            </div>
          </>
        )}

        {stage === 'sending' && (
          <>
            <div className="glyph-big pulse">♛</div>
            <h3>Sending STK Push…</h3>
            <p>Check your phone and enter your M-Pesa PIN to complete the payment.</p>
          </>
        )}

        {stage === 'success' && (
          <>
            <div className="glyph-big success">✓</div>
            <h3>Payment Received</h3>
            <p>
              {amount} confirmed for {childName} — August subscription. Receipt sent via SMS.
            </p>
            <Button onClick={onClose}>Done</Button>
          </>
        )}
      </div>
    </div>
  );
}

export type { ModalStage };
