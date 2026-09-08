import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RateCardsAdmin } from './RateCardsAdmin';
import type { RateCard } from '@/lib/rate-cards';

const createCalls: unknown[] = [];
const removeCalls: string[] = [];
let listImpl: () => Promise<RateCard[]>;

vi.mock('@/lib/rate-cards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-cards')>();
  return {
    ...actual,
    rateCardsApi: {
      list: () => listImpl(),
      get: vi.fn(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'new' } as RateCard);
      },
      update: vi.fn(),
      remove: (id: string) => {
        removeCalls.push(id);
        return Promise.resolve({ id });
      }
    }
  };
});

const card = (over: Partial<RateCard>): RateCard => ({
  id: 'rc1',
  name: 'Centre novices',
  deliveryType: 'CENTER',
  level: 'NOVICE',
  clientType: null,
  unit: 'PER_SESSION',
  amount: '1500',
  currency: 'KES',
  active: true,
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveTo: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over
});

beforeEach(() => {
  createCalls.length = 0;
  removeCalls.length = 0;
  listImpl = async () => [card({ id: 'rc1' }), card({ id: 'rc2', name: 'Home advanced', deliveryType: 'HOME', level: 'ADVANCED', active: false })];
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <RateCardsAdmin />
    </MemoryRouter>
  );
}

describe('RateCardsAdmin', () => {
  it('lists cards with their rate and status', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Centre novices')).toBeInTheDocument();
    expect(within(table).getAllByText(/KES 1,500 per session/i).length).toBeGreaterThan(0);
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
  });

  it('creates a card from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New rate card' }));
    await user.type(screen.getByLabelText('Name'), 'Centre intermediate');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '1800');
    await user.click(screen.getByRole('button', { name: 'Create rate card' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ name: 'Centre intermediate', amount: 1800, deliveryType: 'CENTER' });
  });
});
