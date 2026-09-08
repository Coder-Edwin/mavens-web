import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EnrollmentsAdmin } from './EnrollmentsAdmin';
import type { Enrollment, EnrollmentFilters } from '@/lib/enrollments';

const listCalls: EnrollmentFilters[] = [];
const createCalls: unknown[] = [];
const placeCalls: { id: string; body: unknown }[] = [];
let listImpl: (f: EnrollmentFilters) => Promise<Enrollment[]>;
let getImpl: (id: string) => Promise<Enrollment>;

vi.mock('@/lib/enrollments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/enrollments')>();
  return {
    ...actual,
    enrollmentsApi: {
      list: (f: EnrollmentFilters = {}) => {
        listCalls.push(f);
        return listImpl(f);
      },
      get: (id: string) => getImpl(id),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'new' } as Enrollment);
      },
      update: vi.fn(),
      place: (id: string, body: unknown) => {
        placeCalls.push({ id, body });
        return Promise.resolve({ id } as Enrollment);
      },
      pause: vi.fn(),
      resume: vi.fn(),
      withdraw: vi.fn(),
      waitlist: vi.fn(),
      remove: vi.fn()
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
          { id: 'stu1', firstName: 'Faith', lastName: 'Wambui', level: null, dateOfBirth: null, homeAddress: null, priorExperience: null, joinedAt: '2026-01-01' }
        ]),
      get: vi.fn()
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
    coachesApi: { list: () => Promise.resolve([]), get: vi.fn(), create: vi.fn(), update: vi.fn() }
  };
});

const enrollment = (over: Partial<Enrollment>): Enrollment => ({
  id: 'en1',
  studentId: 'stu1',
  deliveryType: 'CENTER',
  schoolGroupId: null,
  clientType: 'INDIVIDUAL',
  level: null,
  assignedCoachId: null,
  status: 'PENDING_PLACEMENT',
  startDate: '2026-09-01T00:00:00Z',
  endDate: null,
  pausedFrom: null,
  pausedTo: null,
  waitlistNote: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  student: { id: 'stu1', firstName: 'Faith', lastName: 'Wambui' },
  schoolGroup: null,
  assignedCoach: null,
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <EnrollmentsAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listCalls.length = 0;
  createCalls.length = 0;
  placeCalls.length = 0;
  listImpl = async () => [enrollment({ id: 'en1', status: 'PENDING_PLACEMENT' })];
  getImpl = async (id) => enrollment({ id, status: 'PENDING_PLACEMENT', events: [] });
});

describe('EnrollmentsAdmin', () => {
  it('lists enrollments with student name and status', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Faith Wambui')).toBeInTheDocument();
    expect(within(table).getByText('Awaiting placement')).toBeInTheDocument();
  });

  it('filters by status when a tab is chosen', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Active' }));
    expect(listCalls.some((f) => f.status === 'ACTIVE')).toBe(true);
  });

  it('places a pending enrollment from the manage panel', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    await user.click(within(table).getByRole('button', { name: 'Manage' }));
    await user.selectOptions(screen.getByLabelText('Placement level'), 'INTERMEDIATE');
    await user.click(screen.getByRole('button', { name: 'Place' }));

    expect(placeCalls).toEqual([{ id: 'en1', body: { level: 'INTERMEDIATE' } }]);
  });

  it('creates an enrollment from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New enrollment' }));
    await user.selectOptions(screen.getByLabelText('Student'), 'stu1');
    await user.click(screen.getByRole('button', { name: 'Create enrollment' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ studentId: 'stu1', deliveryType: 'CENTER' });
  });
});
