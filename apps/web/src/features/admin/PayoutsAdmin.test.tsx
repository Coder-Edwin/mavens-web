import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PayoutsAdmin } from './PayoutsAdmin';
import type { PayoutRun } from '@/lib/payouts';

const generateCalls: unknown[] = [];
const approveCalls: string[] = [];
let listImpl: () => Promise<PayoutRun[]>;
let getImpl: (id: string) => Promise<PayoutRun>;

vi.mock('@/lib/payouts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payouts')>();
  return {
    ...actual,
    payoutsApi: {
      list: () => listImpl(),
      get: (id: string) => getImpl(id),
      generate: (b: unknown) => {
        generateCalls.push(b);
        return Promise.resolve({ id: 'new' } as PayoutRun);
      },
      approve: (id: string) => {
        approveCalls.push(id);
        return Promise.resolve({ id, status: 'APPROVED' } as PayoutRun);
      },
      markPaid: vi.fn(),
      remove: vi.fn(),
      exportCsv: vi.fn()
    }
  };
});

const run = (over: Partial<PayoutRun>): PayoutRun => ({
  id: 'pr1',
  periodStart: '2026-06-01T00:00:00Z',
  periodEnd: '2026-06-30T00:00:00Z',
  status: 'DRAFT',
  notes: null,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
  _count: { items: 2 },
  items: [
    { id: 'it1', coachId: 'c1', sessionCount: 8, ratePerSession: '900', amount: '7200', notes: null, coach: { id: 'c1', firstName: 'Brian', lastName: 'Otieno', user: { email: 'b@x.com' } } },
    { id: 'it2', coachId: 'c2', sessionCount: 3, ratePerSession: '0', amount: '0', notes: 'No session rate set for this coach', coach: { id: 'c2', firstName: null, lastName: null, user: { email: 'c@x.com' } } }
  ],
  ...over
});

beforeEach(() => {
  generateCalls.length = 0;
  approveCalls.length = 0;
  listImpl = async () => [run({ id: 'pr1', items: undefined })];
  getImpl = async (id) => run({ id });
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <PayoutsAdmin />
    </MemoryRouter>
  );
}

describe('PayoutsAdmin', () => {
  it('lists payout runs with their period and coach count', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('2')).toBeInTheDocument(); // coach count
  });

  it('generates a run from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Generate run' }));
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    expect(generateCalls).toHaveLength(1);
  });

  it('opens a run and approves it, showing the items and the missing-rate flag', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    await user.click(within(table).getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Brian Otieno')).toBeInTheDocument();
    expect(screen.getByText(/No session rate set/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(approveCalls).toEqual(['pr1']);
  });
});
