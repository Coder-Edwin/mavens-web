import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CoursesAdmin } from './CoursesAdmin';
import type { Course } from '@/lib/courses';

const createCalls: unknown[] = [];
const updateCalls: { id: string; patch: unknown }[] = [];
let listImpl: () => Promise<Course[]>;

vi.mock('@/lib/courses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses')>();
  return {
    ...actual,
    coursesApi: {
      ...actual.coursesApi,
      list: () => listImpl(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'c-new' } as Course);
      },
      update: (id: string, patch: unknown) => {
        updateCalls.push({ id, patch });
        return Promise.resolve({ id } as Course);
      },
      remove: vi.fn()
    }
  };
});

const course = (over: Partial<Course>): Course => ({
  id: 'c1',
  slug: 'openings-basics',
  title: 'Openings basics',
  summary: 'First principles',
  level: 'NOVICE',
  status: 'DRAFT',
  coverImageUrl: null,
  estimatedHours: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  _count: { modules: 2, assignments: 0 },
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/app/courses']}>
      <Routes>
        <Route path="/app/courses" element={<CoursesAdmin />} />
        <Route path="/app/courses/:id" element={<div>EDITOR c-new</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCalls.length = 0;
  updateCalls.length = 0;
  listImpl = async () => [course({ id: 'c1' }), course({ id: 'c2', title: 'Endgame drills', status: 'PUBLISHED' })];
});

describe('CoursesAdmin', () => {
  it('lists courses with module count and status', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Openings basics')).toBeInTheDocument();
    expect(within(table).getByText('Endgame drills')).toBeInTheDocument();
    expect(within(table).getByText('Published')).toBeInTheDocument();
  });

  it('creates a course then navigates to the editor', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New course' }));
    await user.type(screen.getByLabelText('Title'), 'Tactics 101');
    await user.click(screen.getByRole('button', { name: 'Create & build' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ title: 'Tactics 101', status: 'DRAFT' });
    expect(await screen.findByText('EDITOR c-new')).toBeInTheDocument();
  });

  it('publishes a draft from the row action', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Openings basics').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Publish' }));
    expect(updateCalls[0]).toEqual({ id: 'c1', patch: { status: 'PUBLISHED' } });
  });
});
