import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionAgenda } from './SessionAgenda';
import { isoDay, type SessionRecord } from '@/lib/sessions';

const listCalls: unknown[] = [];
const completeCalls: { id: string; body: unknown }[] = [];
const cancelCalls: string[] = [];
let listImpl: () => Promise<SessionRecord[]>;

vi.mock('@/lib/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sessions')>();
  return {
    ...actual,
    sessionsApi: {
      list: (f: unknown) => {
        listCalls.push(f);
        return listImpl();
      },
      get: vi.fn(),
      complete: (id: string, body: unknown) => {
        completeCalls.push({ id, body });
        return Promise.resolve({} as SessionRecord);
      },
      cancel: (id: string) => {
        cancelCalls.push(id);
        return Promise.resolve({} as SessionRecord);
      }
    }
  };
});

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: {
      list: () =>
        Promise.resolve([
          { id: 'stu-1', firstName: 'Faith', lastName: 'Wambui', level: null, dateOfBirth: null, homeAddress: null, priorExperience: null, joinedAt: '2026-01-01' },
          { id: 'stu-2', firstName: 'Ben', lastName: 'Kip', level: null, dateOfBirth: null, homeAddress: null, priorExperience: null, joinedAt: '2026-01-01' }
        ]),
      get: vi.fn()
    }
  };
});

// A session dated "today" so it lands in the default current-week view.
function todaySessionAt(hour: number): SessionRecord {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return {
    id: 's-1',
    coachId: 'coach-1',
    groupName: 'Westlands',
    date: isoDay(d),
    startsAt: d.toISOString(),
    endsAt: d.toISOString(),
    topic: 'Rook endgames',
    notes: null,
    status: 'SCHEDULED',
    classScheduleId: 'cs-1',
    classSchedule: { id: 'cs-1', title: 'Rook endgames', deliveryType: 'CENTER', venue: 'Westlands' },
    attendance: []
  };
}

beforeEach(() => {
  listCalls.length = 0;
  completeCalls.length = 0;
  cancelCalls.length = 0;
  listImpl = async () => [todaySessionAt(10)];
});

describe('SessionAgenda', () => {
  it('loads the current week and lists a scheduled session', async () => {
    render(<SessionAgenda />);
    expect(await screen.findByText('Rook endgames')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /this week/i })).toBeInTheDocument();
    expect(listCalls.length).toBeGreaterThan(0);
  });

  it('runs a session: fills attendance and calls complete', async () => {
    const user = userEvent.setup();
    render(<SessionAgenda />);
    await screen.findByText('Rook endgames');

    await user.click(screen.getByRole('button', { name: 'Run' }));
    await user.click(await screen.findByLabelText('Faith Wambui'));
    await user.click(screen.getByRole('button', { name: 'Save attendance' }));

    expect(completeCalls).toHaveLength(1);
    expect(completeCalls[0].id).toBe('s-1');
    expect(completeCalls[0].body).toMatchObject({ presentStudentIds: ['stu-1'] });
  });

  it('cancels a session after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<SessionAgenda />);
    await screen.findByText('Rook endgames');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancelCalls).toEqual(['s-1']);
  });

  it('passes scope=own through to the API', async () => {
    render(<SessionAgenda scope="own" />);
    await screen.findByText('Rook endgames');
    expect((listCalls[0] as { scope?: string }).scope).toBe('own');
  });
});
