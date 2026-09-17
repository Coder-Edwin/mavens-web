import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParentTournaments } from './ParentTournaments';
import type { TournamentSummary } from '@/lib/tournaments';
import type { StudentRecord } from '@/lib/students';

const registerCalls: { id: string; studentId: string }[] = [];
let listImpl: () => Promise<TournamentSummary[]>;
let rosterImpl: () => Promise<StudentRecord[]>;

vi.mock('@/lib/tournaments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tournaments')>();
  return {
    ...actual,
    tournamentsApi: {
      list: () => listImpl(),
      register: (id: string, studentId: string) => {
        registerCalls.push({ id, studentId });
        return Promise.resolve({});
      }
    }
  };
});

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: {
      list: () => rosterImpl(),
      get: vi.fn()
    }
  };
});

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

beforeEach(() => {
  registerCalls.length = 0;
  listImpl = async () => [tournament()];
  rosterImpl = async () => [student()];
});

describe('ParentTournaments', () => {
  it('gives the Tournaments nav item a real page', async () => {
    render(<ParentTournaments />);
    expect(await screen.findByText('Club Rapid #4')).toBeInTheDocument();
  });

  it('registers the active child for a tournament', async () => {
    const user = userEvent.setup();
    render(<ParentTournaments />);
    await screen.findByText('Club Rapid #4');

    await user.click(screen.getByRole('button', { name: /register faith/i }));

    expect(registerCalls).toEqual([{ id: 't1', studentId: 'stu-1' }]);
    expect(await screen.findByText('Registered!')).toBeInTheDocument();
  });

  it('disables registration once a tournament is full', async () => {
    listImpl = async () => [tournament({ isFull: true })];
    render(<ParentTournaments />);
    expect(await screen.findByRole('button', { name: 'Full' })).toBeDisabled();
  });
});
