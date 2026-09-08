import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PlacementsAdmin } from './PlacementsAdmin';
import type { PlacementAssessment, PlacementFilters } from '@/lib/placements';

const listCalls: PlacementFilters[] = [];
const completeCalls: { id: string; body: unknown }[] = [];
const scheduleCalls: unknown[] = [];
let listImpl: (f: PlacementFilters) => Promise<PlacementAssessment[]>;

vi.mock('@/lib/placements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/placements')>();
  return {
    ...actual,
    placementsApi: {
      list: (f: PlacementFilters = {}) => {
        listCalls.push(f);
        return listImpl(f);
      },
      get: vi.fn(),
      schedule: (input: unknown) => {
        scheduleCalls.push(input);
        return Promise.resolve({ id: 'new' } as PlacementAssessment);
      },
      update: vi.fn(),
      complete: (id: string, body: unknown) => {
        completeCalls.push({ id, body });
        return Promise.resolve({ id } as PlacementAssessment);
      },
      cancel: vi.fn().mockResolvedValue({} as PlacementAssessment),
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

const assessment = (over: Partial<PlacementAssessment>): PlacementAssessment => ({
  id: 'pa1',
  studentId: 'stu1',
  enrollmentId: null,
  scheduledFor: '2026-10-01T09:00:00Z',
  assessorCoachId: null,
  status: 'SCHEDULED',
  resultLevel: null,
  notes: null,
  completedAt: null,
  nextReviewDue: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  student: { id: 'stu1', firstName: 'Faith', lastName: 'Wambui', level: null },
  assessorCoach: null,
  enrollment: null,
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <PlacementsAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listCalls.length = 0;
  completeCalls.length = 0;
  scheduleCalls.length = 0;
  listImpl = async () => [assessment({ id: 'pa1', status: 'SCHEDULED' })];
});

describe('PlacementsAdmin', () => {
  it('opens on the scheduled queue', async () => {
    renderAdmin();
    await screen.findByRole('table');
    expect(listCalls[0]).toEqual({ status: 'SCHEDULED' });
    expect(screen.getByText('Faith Wambui')).toBeInTheDocument();
  });

  it('queries the review-due list from the Review due tab', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Review due' }));
    expect(listCalls.some((f) => typeof f.dueBefore === 'string')).toBe(true);
  });

  it('completes an assessment with the chosen level after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    await user.selectOptions(
      within(table).getByRole('combobox', { name: /result level for/i }),
      'ADVANCED'
    );
    await user.click(within(table).getByRole('button', { name: 'Complete' }));

    expect(completeCalls).toEqual([{ id: 'pa1', body: { resultLevel: 'ADVANCED' } }]);
  });

  it('schedules a new assessment from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Schedule assessment' }));
    await user.selectOptions(screen.getByLabelText('Student'), 'stu1');
    await user.click(screen.getByRole('button', { name: 'Schedule' }));

    expect(scheduleCalls).toHaveLength(1);
    expect(scheduleCalls[0]).toMatchObject({ studentId: 'stu1' });
  });
});
