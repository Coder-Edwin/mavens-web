import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TournamentDetail } from './TournamentDetail';
import type { Tournament, TournamentRound, StandingRow } from '@/lib/tournaments';

const pairCalls: string[] = [];
const resultCalls: { pairingId: string; result: string }[] = [];
let roundsImpl: () => Promise<TournamentRound[]>;

vi.mock('@/lib/tournaments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tournaments')>();
  return {
    ...actual,
    tournamentsApi: {
      ...actual.tournamentsApi,
      get: async (): Promise<Tournament> => ({
        id: 't1',
        name: 'Term Blitz',
        date: '2026-10-04T00:00:00Z',
        venue: 'Westlands',
        feeAmount: '500',
        capacity: null,
        totalRounds: 3,
        registrationDeadline: null,
        registrations: [
          { id: 'r1', studentId: 's1', registeredAt: '2026-01-01', result: null, seed: 1, withdrawn: false, student: { firstName: 'A', lastName: 'One' } },
          { id: 'r2', studentId: 's2', registeredAt: '2026-01-01', result: null, seed: 2, withdrawn: false, student: { firstName: 'B', lastName: 'Two' } }
        ]
      }),
      rounds: () => roundsImpl(),
      standings: async (): Promise<StandingRow[]> => [],
      pairNextRound: (id: string) => {
        pairCalls.push(id);
        return Promise.resolve({} as TournamentRound);
      },
      recordPairingResult: (_id: string, pairingId: string, result: string) => {
        resultCalls.push({ pairingId, result });
        return Promise.resolve({} as TournamentRound);
      },
      deleteRound: vi.fn(),
      updateRegistration: vi.fn()
    }
  };
});

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return { ...actual, studentsApi: { list: () => Promise.resolve([]), get: vi.fn() } };
});

const round1 = (): TournamentRound => ({
  id: 'rd1',
  number: 1,
  status: 'PAIRED',
  pairings: [
    {
      id: 'p1',
      board: 1,
      whiteRegistrationId: 'r1',
      blackRegistrationId: 'r2',
      result: null,
      white: { id: 'r1', student: { firstName: 'A', lastName: 'One' } },
      black: { id: 'r2', student: { firstName: 'B', lastName: 'Two' } }
    }
  ]
});

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/app/tournaments/t1']}>
      <Routes>
        <Route path="/app/tournaments/:id" element={<TournamentDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  pairCalls.length = 0;
  resultCalls.length = 0;
  roundsImpl = async () => [];
});

describe('TournamentDetail', () => {
  it('pairs the first round when none exist', async () => {
    const user = userEvent.setup();
    renderDetail();
    const btn = await screen.findByRole('button', { name: /pair round 1/i });
    await user.click(btn);
    expect(pairCalls).toEqual(['t1']);
  });

  it('records a board result from the round table', async () => {
    roundsImpl = async () => [round1()];
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Round 1');

    await user.selectOptions(screen.getByLabelText('Result board 1'), 'WHITE_WIN');
    expect(resultCalls[0]).toEqual({ pairingId: 'p1', result: 'WHITE_WIN' });
  });

  it('blocks pairing round 2 while round 1 is unfinished', async () => {
    roundsImpl = async () => [round1()];
    renderDetail();
    await screen.findByText('Round 1');
    expect(screen.getByRole('button', { name: /pair round 2/i })).toBeDisabled();
  });
});
