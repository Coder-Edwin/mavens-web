import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Badges } from './Badges';
import type { Badge, StudentBadge } from '@/lib/badges';
import type { StudentRecord } from '@/lib/students';

let authUser = { id: 'admin-1', email: 'admin@x.com', role: 'ADMIN' as const, isCoach: false };
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: authUser })
}));

const createCalls: unknown[] = [];
const awardCalls: { studentId: string; badgeId: string }[] = [];
const revokeCalls: { badgeId: string; studentId: string }[] = [];
let listBadgesImpl: () => Promise<Badge[]>;
let forStudentImpl: (id: string) => Promise<StudentBadge[]>;

vi.mock('@/lib/badges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/badges')>();
  return {
    ...actual,
    badgesApi: {
      list: () => listBadgesImpl(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'badge-9' } as Badge);
      },
      update: vi.fn(),
      remove: vi.fn(),
      award: (studentId: string, badgeId: string) => {
        awardCalls.push({ studentId, badgeId });
        return Promise.resolve({} as StudentBadge);
      },
      revoke: (badgeId: string, studentId: string) => {
        revokeCalls.push({ badgeId, studentId });
        return Promise.resolve({ studentId, badgeId });
      },
      forStudent: (id: string) => forStudentImpl(id),
      mine: vi.fn()
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
          { id: 'stu-1', firstName: 'Faith', lastName: 'Wambui', level: null, dateOfBirth: null, homeAddress: null, priorExperience: null, joinedAt: '2026-01-01' }
        ] as StudentRecord[]),
      get: vi.fn()
    }
  };
});

const badge = (over: Partial<Badge> = {}): Badge => ({
  id: 'badge-1',
  name: 'First Tournament Win',
  icon: '🏆',
  criteria: 'Won a rated game',
  ...over
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Badges />
    </MemoryRouter>
  );
}

beforeEach(() => {
  authUser = { id: 'admin-1', email: 'admin@x.com', role: 'ADMIN', isCoach: false };
  createCalls.length = 0;
  awardCalls.length = 0;
  revokeCalls.length = 0;
  listBadgesImpl = async () => [badge()];
  forStudentImpl = async () => [];
});

describe('Badges', () => {
  it('lists the badge catalog', async () => {
    renderPage();
    expect(await screen.findByText('First Tournament Win')).toBeInTheDocument();
    expect(screen.getByText('Won a rated game')).toBeInTheDocument();
  });

  it('lets an admin create a new badge', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('First Tournament Win');

    await user.click(screen.getByRole('button', { name: 'New badge' }));
    await user.type(screen.getByLabelText('Name'), 'Puzzle Streak');
    await user.click(screen.getByRole('button', { name: 'Create badge' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ name: 'Puzzle Streak' });
  });

  it('hides the "New badge" control from a coach', async () => {
    authUser = { id: 'coach-1', email: 'coach@x.com', role: 'COACH' as never, isCoach: true };
    renderPage();
    await screen.findByText('First Tournament Win');
    expect(screen.queryByRole('button', { name: 'New badge' })).not.toBeInTheDocument();
  });

  it('awards a badge to the selected student', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('First Tournament Win');
    await screen.findByLabelText('Student');

    await user.click(screen.getByRole('button', { name: 'Award' }));

    expect(awardCalls).toEqual([{ studentId: 'stu-1', badgeId: 'badge-1' }]);
  });

  it('lets an admin revoke an earned badge', async () => {
    forStudentImpl = async () => [
      { studentId: 'stu-1', badgeId: 'badge-1', earnedAt: '2026-09-01T00:00:00Z', badge: badge() }
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /remove first tournament win/i }));

    expect(revokeCalls).toEqual([{ badgeId: 'badge-1', studentId: 'stu-1' }]);
  });
});
