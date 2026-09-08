import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyCoursesPage } from './MyCoursesPage';
import type { CourseAssignment } from '@/lib/courses';

let mineImpl: () => Promise<CourseAssignment[]>;

vi.mock('@/lib/courses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses')>();
  return {
    ...actual,
    coursesApi: { ...actual.coursesApi, mine: () => mineImpl() }
  };
});

const assignment = (over: Partial<CourseAssignment>): CourseAssignment => ({
  id: 'a1',
  courseId: 'c1',
  studentId: 'stu-1',
  status: 'IN_PROGRESS',
  assignedAt: '2026-01-01T00:00:00Z',
  dueAt: null,
  startedAt: null,
  completedAt: null,
  course: { id: 'c1', title: 'Openings basics', level: 'NOVICE', summary: 'First principles' },
  progress: { total: 8, done: 3 },
  ...over
});

beforeEach(() => {
  mineImpl = async () => [assignment({ id: 'a1' })];
});

describe('MyCoursesPage', () => {
  it('lists assigned courses with progress', async () => {
    render(
      <MemoryRouter>
        <MyCoursesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Openings basics')).toBeInTheDocument();
    expect(screen.getByText('3/8 lessons', { exact: false })).toBeInTheDocument();
  });

  it('shows an empty state when nothing is assigned', async () => {
    mineImpl = async () => [];
    render(
      <MemoryRouter>
        <MyCoursesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/hasn't assigned any courses/i)).toBeInTheDocument();
  });
});
