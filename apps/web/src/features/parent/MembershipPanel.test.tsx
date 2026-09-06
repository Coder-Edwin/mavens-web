import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MembershipPanel } from './MembershipPanel';
import { ApiError } from '@/lib/api-client';
import type { Membership } from '@/lib/membership';

// Plain stubs (not vi.fn) so a rejecting impl isn't flagged as an unhandled
// rejection by vitest's mock-result tracking.
const payCalls: { studentId: string; phone: string }[] = [];
let forStudentImpl: (studentId: string) => Promise<Membership | null>;
let payImpl: () => Promise<{ paymentId: string; status: string; message: string }>;

vi.mock('@/lib/membership', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/membership')>();
  return {
    ...actual,
    membershipApi: {
      forStudent: (studentId: string) => forStudentImpl(studentId),
      pay: (studentId: string, phone: string) => {
        payCalls.push({ studentId, phone });
        return payImpl();
      }
    }
  };
});

const activeMembership: Membership = {
  id: 'm1',
  studentId: 's1',
  status: 'ACTIVE',
  periodStart: '2026-01-01T00:00:00Z',
  periodEnd: '2099-01-01T00:00:00Z',
  plan: { name: 'Annual Membership', amount: '6000' }
};

function renderPanel() {
  return render(<MembershipPanel studentId="s1" childName="Faith" phoneNumber="254712345678" />);
}

beforeEach(() => {
  payCalls.length = 0;
  forStudentImpl = async () => null;
  payImpl = async () => ({ paymentId: 'p1', status: 'PENDING', message: 'STK push sent — check your phone.' });
});

describe('MembershipPanel', () => {
  it('shows a "not a member" state and a pay button when there is no membership', async () => {
    renderPanel();
    expect(await screen.findByText(/not a member/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay membership/i })).toBeInTheDocument();
  });

  it('shows the member state with the expiry date when active', async () => {
    forStudentImpl = async () => activeMembership;
    renderPanel();
    expect(await screen.findByText('Member')).toBeInTheDocument();
    expect(screen.getByText(/valid until/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /renew membership/i })).toBeInTheDocument();
  });

  it('starts the membership payment with the shared phone number', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: /pay membership/i }));

    expect(payCalls[0]).toEqual({ studentId: 's1', phone: '254712345678' });
    expect(await screen.findByText(/stk push sent/i)).toBeInTheDocument();
  });

  it('surfaces an API error without crashing', async () => {
    payImpl = async () => {
      throw new ApiError(400, 'No active membership fee is configured');
    };
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: /pay membership/i }));

    expect(await screen.findByText(/no active membership fee is configured/i)).toBeInTheDocument();
  });
});
