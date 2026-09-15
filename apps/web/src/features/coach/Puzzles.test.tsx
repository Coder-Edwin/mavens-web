import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Puzzles } from './Puzzles';
import type { PuzzleAssignment, PuzzleSet } from '@/lib/puzzles';
import type { StudentRecord } from '@/lib/students';

const createSetCalls: unknown[] = [];
const assignCalls: unknown[] = [];
const gradeCalls: { id: string; body: unknown }[] = [];
let listSetsImpl: () => Promise<PuzzleSet[]>;
let listAssignmentsImpl: () => Promise<PuzzleAssignment[]>;
let rosterImpl: () => Promise<StudentRecord[]>;

vi.mock('@/lib/puzzles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/puzzles')>();
  return {
    ...actual,
    puzzlesApi: {
      listSets: () => listSetsImpl(),
      createSet: (input: unknown) => {
        createSetCalls.push(input);
        return Promise.resolve({ id: 'ps-9' } as PuzzleSet);
      },
      listAssignments: () => listAssignmentsImpl(),
      assign: (input: unknown) => {
        assignCalls.push(input);
        return Promise.resolve([]);
      },
      grade: (id: string, body: unknown) => {
        gradeCalls.push({ id, body });
        return Promise.resolve({});
      }
    }
  };
});

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: { list: () => rosterImpl(), get: vi.fn() }
  };
});

const set = (over: Partial<PuzzleSet> = {}): PuzzleSet => ({
  id: 'ps-1',
  coachId: 'coach-1',
  title: 'Rook Endgames',
  description: null,
  difficulty: 'Intermediate',
  createdAt: '2026-09-01T00:00:00Z',
  ...over
});

const assignment = (over: Partial<PuzzleAssignment> = {}): PuzzleAssignment => ({
  id: 'pa-1',
  puzzleSetId: 'ps-1',
  studentId: 'stu-1',
  status: 'SUBMITTED',
  dueDate: null,
  assignedAt: '2026-09-01T00:00:00Z',
  puzzleSet: set(),
  submission: { id: 'sub-1', assignmentId: 'pa-1', submittedAt: '2026-09-02T00:00:00Z', score: null, feedback: null, gradedById: null, gradedAt: null },
  student: { firstName: 'Faith', lastName: 'Wambui' },
  ...over
});

const student = (over: Partial<StudentRecord> = {}): StudentRecord => ({
  id: 'stu-1',
  firstName: 'Faith',
  lastName: 'Wambui',
  level: 'NOVICE',
  dateOfBirth: null,
  homeAddress: null,
  priorExperience: null,
  joinedAt: '2026-01-01T00:00:00Z',
  ...over
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Puzzles />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createSetCalls.length = 0;
  assignCalls.length = 0;
  gradeCalls.length = 0;
  listSetsImpl = async () => [set()];
  listAssignmentsImpl = async () => [];
  rosterImpl = async () => [student()];
});

describe('Puzzles', () => {
  it('lists puzzle sets and assignments', async () => {
    listAssignmentsImpl = async () => [assignment()];
    renderPage();
    await screen.findByRole('button', { name: 'New puzzle set' });
    expect(screen.getAllByText('Rook Endgames').length).toBeGreaterThan(0);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Faith Wambui')).toBeInTheDocument();
  });

  it('creates a new puzzle set', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'New puzzle set' });

    await user.click(screen.getByRole('button', { name: 'New puzzle set' }));
    await user.type(screen.getByLabelText('Title'), 'Opening Traps');
    await user.click(screen.getByRole('button', { name: 'Create set' }));

    expect(createSetCalls).toHaveLength(1);
    expect(createSetCalls[0]).toMatchObject({ title: 'Opening Traps' });
  });

  it('assigns a puzzle set to a selected student', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'New puzzle set' });

    await user.click(screen.getByRole('checkbox', { name: 'Faith Wambui' }));
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(assignCalls).toHaveLength(1);
    expect(assignCalls[0]).toMatchObject({ puzzleSetId: 'ps-1', studentIds: ['stu-1'] });
  });

  it('grades a submitted assignment', async () => {
    listAssignmentsImpl = async () => [assignment()];
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'New puzzle set' });

    await user.click(screen.getByRole('button', { name: 'Grade' }));
    await user.type(screen.getByPlaceholderText('Score'), '90');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(gradeCalls).toEqual([{ id: 'pa-1', body: { score: 90, feedback: undefined } }]);
  });
});
