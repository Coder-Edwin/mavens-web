import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudentsAdmin } from './StudentsAdmin';
import type { StudentRecord } from '@/lib/students';

const createCalls: unknown[] = [];
const updateCalls: { id: string; patch: unknown }[] = [];
let listImpl: () => Promise<StudentRecord[]>;

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: {
      list: () => listImpl(),
      get: vi.fn(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({
          student: { id: 's9', firstName: 'New', lastName: 'Student' },
          tempPassword: 'temp123'
        });
      },
      update: (id: string, patch: unknown) => {
        updateCalls.push({ id, patch });
        return Promise.resolve({ id } as StudentRecord);
      }
    }
  };
});

vi.mock('@/lib/coaches', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/coaches')>();
  return {
    ...actual,
    coachesApi: {
      list: () => Promise.resolve([{ id: 'coach-1', firstName: 'Brian', lastName: 'Otieno', user: { email: 'brian@x.com' } }]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  };
});

const student = (over: Partial<StudentRecord>): StudentRecord => ({
  id: 's1',
  firstName: 'Faith',
  lastName: 'Wambui',
  level: 'NOVICE',
  dateOfBirth: '2014-05-01T00:00:00Z',
  homeAddress: null,
  priorExperience: null,
  joinedAt: '2026-01-01T00:00:00Z',
  user: { email: 'faith@example.com', isActive: true },
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <StudentsAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCalls.length = 0;
  updateCalls.length = 0;
  listImpl = async () => [
    student({ id: 's1' }),
    student({ id: 's2', firstName: 'Brian', lastName: 'Otieno', level: null, user: { email: 'brian2@example.com', isActive: true } })
  ];
});

describe('StudentsAdmin', () => {
  it('lists students with their level and login email', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Faith Wambui')).toBeInTheDocument();
    expect(within(table).getAllByText('faith@example.com').length).toBeGreaterThan(0);
    expect(within(table).getByText('Unplaced')).toBeInTheDocument(); // s2 has no level
  });

  it('creates a student, optionally assigning a coach, and surfaces the temp password', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New student' }));
    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'Student');
    await user.type(screen.getByLabelText(/Login email/), 'new@x.com');
    await user.selectOptions(screen.getByLabelText(/Assign a coach/), 'coach-1');
    await user.click(screen.getByRole('button', { name: 'Create student' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ email: 'new@x.com', firstName: 'New', lastName: 'Student', coachId: 'coach-1' });
    expect(await screen.findByText(/Temp password:/)).toBeInTheDocument();
  });

  it('edits a student without letting the email change, and hides the coach picker', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Faith Wambui').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText(/Login email/)).toBeDisabled();
    expect(screen.queryByLabelText(/Assign a coach/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Home address/), '12 Ngong Rd');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateCalls[0]).toMatchObject({ id: 's1', patch: { homeAddress: '12 Ngong Rd' } });
  });
});
