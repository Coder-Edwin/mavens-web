import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TournamentsAdmin } from './TournamentsAdmin';
import type { TournamentSummary } from '@/lib/tournaments';

const createCalls: unknown[] = [];
let listImpl: () => Promise<TournamentSummary[]>;

vi.mock('@/lib/tournaments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tournaments')>();
  return {
    ...actual,
    tournamentsApi: {
      ...actual.tournamentsApi,
      list: () => listImpl(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 't-new' } as TournamentSummary);
      }
    }
  };
});

const t = (over: Partial<TournamentSummary>): TournamentSummary => ({
  id: 't1',
  name: 'Term Blitz',
  date: '2026-10-04T00:00:00Z',
  venue: 'Westlands',
  feeAmount: '500',
  capacity: 24,
  totalRounds: 5,
  registrationDeadline: null,
  registeredCount: 12,
  isFull: false,
  ...over
});

beforeEach(() => {
  createCalls.length = 0;
  listImpl = async () => [t({ id: 't1' })];
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <TournamentsAdmin />
    </MemoryRouter>
  );
}

describe('TournamentsAdmin', () => {
  it('lists tournaments with player counts', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Term Blitz')).toBeInTheDocument();
    expect(within(table).getByText('12/24')).toBeInTheDocument();
  });

  it('creates a tournament from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New tournament' }));
    await user.type(screen.getByLabelText('Name'), 'Rapid Open');
    await user.type(screen.getByLabelText('Date'), '2026-11-01');
    await user.type(screen.getByLabelText('Venue'), 'Centre');
    await user.clear(screen.getByLabelText('Fee (KES)'));
    await user.type(screen.getByLabelText('Fee (KES)'), '750');
    await user.click(screen.getByRole('button', { name: 'Create tournament' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ name: 'Rapid Open', venue: 'Centre', feeAmount: 750 });
  });
});
