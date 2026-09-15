import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LessonPlans } from './LessonPlans';
import type { LessonPlan } from '@/lib/lesson-plans';

const createCalls: unknown[] = [];
const updateCalls: { id: string; patch: unknown }[] = [];
const removeCalls: string[] = [];
let listImpl: () => Promise<LessonPlan[]>;

vi.mock('@/lib/lesson-plans', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lesson-plans')>();
  return {
    ...actual,
    lessonPlansApi: {
      list: () => listImpl(),
      get: vi.fn(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'lp-9' } as LessonPlan);
      },
      update: (id: string, patch: unknown) => {
        updateCalls.push({ id, patch });
        return Promise.resolve({ id } as LessonPlan);
      },
      remove: (id: string) => {
        removeCalls.push(id);
        return Promise.resolve({ id });
      }
    }
  };
});

const plan = (over: Partial<LessonPlan> = {}): LessonPlan => ({
  id: 'lp-1',
  coachId: 'coach-1',
  title: 'Rook Endgames',
  objectives: 'Lucena and Philidor positions',
  materialUrl: null,
  difficulty: 'Intermediate',
  createdAt: '2026-09-01T00:00:00Z',
  ...over
});

function renderPage() {
  return render(
    <MemoryRouter>
      <LessonPlans />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCalls.length = 0;
  updateCalls.length = 0;
  removeCalls.length = 0;
  listImpl = async () => [plan()];
});

describe('LessonPlans', () => {
  it('lists lesson plans with their difficulty and objectives', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Rook Endgames')).toBeInTheDocument();
    expect(within(table).getByText('Intermediate')).toBeInTheDocument();
  });

  it('creates a new lesson plan', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New lesson plan' }));
    await user.type(screen.getByLabelText('Title'), 'Opening Traps');
    await user.click(screen.getByRole('button', { name: 'Create lesson plan' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ title: 'Opening Traps' });
  });

  it('edits a lesson plan', async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Rook Endgames').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText(/Difficulty/));
    await user.type(screen.getByLabelText(/Difficulty/), 'Advanced');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateCalls[0]).toMatchObject({ id: 'lp-1', patch: { difficulty: 'Advanced' } });
  });

  it('deletes a lesson plan after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Rook Endgames').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    expect(removeCalls).toEqual(['lp-1']);
  });
});
