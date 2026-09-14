import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentTournaments } from './StudentTournaments';
import type { MyTournamentRegistration, StandingRow, TournamentSummary } from '@/lib/tournaments';

const registerCalls: string[] = [];
let listImpl: () => Promise<TournamentSummary[]>;
let mineImpl: () => Promise<MyTournamentRegistration[]>;
let standingsImpl: (id: string) => Promise<StandingRow[]>;

vi.mock('@/lib/tournaments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tournaments')>();
  return {
    ...actual,
    tournamentsApi: {
      list: () => listImpl(),
      mine: () => mineImpl(),
      registerSelf: (id: string) => {
        registerCalls.push(id);
        return Promise.resolve({} as MyTournamentRegistration);
      },
      standings: (id: string) => standingsImpl(id)
    }
  };
});

const tournament = (over: Partial<TournamentSummary> = {}): TournamentSummary => ({
  id: 't1',
  name: 'Club Rapid #4',
  date: '2026-10-01T00:00:00Z',
  venue: 'Westlands Centre',
  feeAmount: '500.00',
  capacity: 20,
  totalRounds: 5,
  registrationDeadline: null,
  registeredCount: 5,
  isFull: false,
  ...over
});

function renderPage() {
  return render(<StudentTournaments />);
}

beforeEach(() => {
  registerCalls.length = 0;
  listImpl = async () => [tournament()];
  mineImpl = async () => [];
  standingsImpl = async () => [];
});

describe('StudentTournaments', () => {
  it('shows an open tournament with a Register button', async () => {
    renderPage();
    expect(await screen.findByText('Club Rapid #4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('registers for a tournament', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Club Rapid #4');

    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(registerCalls).toEqual(['t1']);
  });

  it('shows "Registered" and a Standings toggle instead of Register when already registered', async () => {
    mineImpl = async () => [
      { id: 'reg-1', studentId: 'stu-1', registeredAt: '2026-09-01', result: null, seed: null, withdrawn: false, tournament: tournament() }
    ];
    renderPage();
    await screen.findByText('Club Rapid #4');

    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Standings' })).toBeInTheDocument();
  });

  it('shows "Full" and no Register button when the tournament has no open seats', async () => {
    listImpl = async () => [tournament({ isFull: true })];
    renderPage();
    expect(await screen.findByText('Full')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
  });

  it('loads and displays standings, highlighting my own row', async () => {
    mineImpl = async () => [
      { id: 'reg-1', studentId: 'stu-1', registeredAt: '2026-09-01', result: null, seed: null, withdrawn: false, tournament: tournament() }
    ];
    standingsImpl = async () => [
      { rank: 1, registrationId: 'reg-other', name: 'Brian Otieno', withdrawn: false, score: 3, buchholz: 6, games: 3, wins: 3, draws: 0, losses: 0, byes: 0, seed: null },
      { rank: 2, registrationId: 'reg-1', name: 'Faith Wambui', withdrawn: false, score: 2, buchholz: 5, games: 3, wins: 2, draws: 0, losses: 1, byes: 0, seed: null }
    ];
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Club Rapid #4');

    await user.click(screen.getByRole('button', { name: 'Standings' }));

    expect(await screen.findByText(/you're ranked #2/i)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Brian Otieno')).toBeInTheDocument();
  });
});
