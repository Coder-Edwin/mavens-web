import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ClassSchedulesAdmin } from './ClassSchedulesAdmin';
import type { ClassSchedule, ScheduleFilters } from '@/lib/class-schedules';

const listCalls: ScheduleFilters[] = [];
const createCalls: unknown[] = [];
const generateCalls: string[] = [];
let listImpl: (f: ScheduleFilters) => Promise<ClassSchedule[]>;

vi.mock('@/lib/class-schedules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/class-schedules')>();
  return {
    ...actual,
    classSchedulesApi: {
      list: (f: ScheduleFilters = {}) => {
        listCalls.push(f);
        return listImpl(f);
      },
      get: vi.fn(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'new' } as ClassSchedule);
      },
      update: vi.fn(),
      generate: (id: string) => {
        generateCalls.push(id);
        return Promise.resolve({ created: 4, skipped: 0, from: '2026-06-01', to: '2026-06-29' });
      },
      remove: vi.fn()
    }
  };
});

vi.mock('@/lib/school-groups', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/school-groups')>();
  return {
    ...actual,
    schoolGroupsApi: { list: () => Promise.resolve([]), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
  };
});

vi.mock('@/lib/coaches', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/coaches')>();
  return {
    ...actual,
    coachesApi: {
      list: () =>
        Promise.resolve([
          { id: 'coach-1', firstName: 'Brian', lastName: 'Otieno', phone: null, bio: null, specialty: null, skills: null, employmentType: 'STAFF', createdAt: '2026-01-01', user: { email: 'brian@x.com', isActive: true } }
        ]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  };
});

vi.mock('@/lib/terms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terms')>();
  return {
    ...actual,
    termsApi: { list: () => Promise.resolve([]), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
  };
});

const sched = (over: Partial<ClassSchedule>): ClassSchedule => ({
  id: 'cs1',
  title: 'Saturday Novices',
  deliveryType: 'CENTER',
  schoolGroupId: null,
  level: 'NOVICE',
  coachId: 'coach-1',
  venue: 'Westlands',
  weekday: 6,
  startTime: '10:00',
  durationMinutes: 90,
  termId: null,
  startDate: '2026-01-01T00:00:00Z',
  endDate: null,
  status: 'ACTIVE',
  capacity: 12,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  coach: { id: 'coach-1', firstName: 'Brian', lastName: 'Otieno', user: { email: 'brian@x.com' } },
  schoolGroup: null,
  term: null,
  _count: { sessions: 0 },
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <ClassSchedulesAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listCalls.length = 0;
  createCalls.length = 0;
  generateCalls.length = 0;
  listImpl = async () => [sched({ id: 'cs1' }), sched({ id: 'cs2', title: 'Home — Advanced', coachId: null, coach: null })];
});

describe('ClassSchedulesAdmin', () => {
  it('lists schedules with their weekday/time and coach', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Saturday Novices')).toBeInTheDocument();
    expect(within(table).getByText('Brian Otieno')).toBeInTheDocument();
    expect(within(table).getByText('unassigned')).toBeInTheDocument();
  });

  it('generates sessions for a schedule and shows the result', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Saturday Novices').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Generate' }));
    expect(generateCalls).toEqual(['cs1']);
    expect(await screen.findByText(/created 4 sessions/)).toBeInTheDocument();
  });

  it('disables Generate for a coachless schedule', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Home — Advanced').closest('tr') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Generate' })).toBeDisabled();
  });

  it('creates a schedule from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New schedule' }));
    await user.type(screen.getByLabelText('Title'), 'Tuesday Intermediate');
    await user.type(screen.getByLabelText('First date'), '2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Create schedule' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ title: 'Tuesday Intermediate', deliveryType: 'CENTER', weekday: 6 });
  });
});
