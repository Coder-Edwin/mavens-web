import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParentPayments } from './ParentPayments';
import type { StudentRecord } from '@/lib/students';

const postCalls: { path: string; body: unknown }[] = [];
let rosterImpl: () => Promise<StudentRecord[]>;

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      post: (path: string, body: unknown) => {
        postCalls.push({ path, body });
        return Promise.resolve({ message: 'Check your phone to complete payment.' });
      }
    }
  };
});

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: { list: () => rosterImpl(), get: vi.fn() }
  };
});

vi.mock('@/features/parent/MembershipPanel', () => ({
  MembershipPanel: ({ childName }: { childName: string }) => <div>Membership for {childName}</div>
}));

const student = (over: Partial<StudentRecord> = {}): StudentRecord => ({
  id: 'stu-1',
  firstName: 'Faith',
  lastName: 'Wambui',
  level: null,
  dateOfBirth: null,
  homeAddress: null,
  priorExperience: null,
  joinedAt: '2026-01-01T00:00:00Z',
  ...over
});

beforeEach(() => {
  postCalls.length = 0;
  rosterImpl = async () => [student()];
});

describe('ParentPayments', () => {
  it('gives the Payments nav item a real page with the M-Pesa flow and membership panel', async () => {
    render(<ParentPayments />);
    expect(await screen.findByText(/Pay Faith's Subscription/)).toBeInTheDocument();
    expect(screen.getByText('Membership for Faith')).toBeInTheDocument();
  });

  it('starts an M-Pesa STK push for the active child', async () => {
    const user = userEvent.setup();
    render(<ParentPayments />);
    await screen.findByText(/Pay Faith's Subscription/);

    await user.click(screen.getByRole('button', { name: /pay with m-pesa/i }));

    expect(postCalls).toHaveLength(1);
    expect(postCalls[0]).toMatchObject({ path: '/payments/mpesa/stk-push', body: { studentId: 'stu-1' } });
    expect(await screen.findByText(/check your phone/i)).toBeInTheDocument();
  });

  it('shows a message when no children are linked', async () => {
    rosterImpl = async () => [];
    render(<ParentPayments />);
    expect(await screen.findByText(/no children linked yet/i)).toBeInTheDocument();
  });
});
