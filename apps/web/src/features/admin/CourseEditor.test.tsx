import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CourseEditor } from './CourseEditor';
import type { Course, CourseAssignment } from '@/lib/courses';

const addModuleCalls: { courseId: string; body: unknown }[] = [];
const addLessonCalls: { moduleId: string; body: unknown }[] = [];
const assignCalls: { courseId: string; body: unknown }[] = [];
let courseImpl: () => Promise<Course>;
let assignmentsImpl: () => Promise<CourseAssignment[]>;

vi.mock('@/lib/courses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses')>();
  return {
    ...actual,
    coursesApi: {
      ...actual.coursesApi,
      get: () => courseImpl(),
      listAssignments: () => assignmentsImpl(),
      addModule: (courseId: string, body: unknown) => {
        addModuleCalls.push({ courseId, body });
        return Promise.resolve({} as never);
      },
      addLesson: (moduleId: string, body: unknown) => {
        addLessonCalls.push({ moduleId, body });
        return Promise.resolve({} as never);
      },
      assign: (courseId: string, body: unknown) => {
        assignCalls.push({ courseId, body });
        return Promise.resolve({ assigned: 1, skipped: 0 });
      },
      removeModule: vi.fn(),
      removeLesson: vi.fn(),
      updateLesson: vi.fn(),
      removeAssignment: vi.fn()
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
        ]),
      get: vi.fn()
    }
  };
});

const course = (over: Partial<Course>): Course => ({
  id: 'c1',
  slug: 'openings',
  title: 'Openings basics',
  summary: null,
  level: 'NOVICE',
  status: 'PUBLISHED',
  coverImageUrl: null,
  estimatedHours: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  modules: [
    { id: 'm1', courseId: 'c1', title: 'Principles', summary: null, position: 0, lessons: [{ id: 'l1', moduleId: 'm1', title: 'Control the centre', body: '...', fen: null, videoUrl: null, estimatedMinutes: 10, position: 0 }] }
  ],
  ...over
});

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/app/courses/c1']}>
      <Routes>
        <Route path="/app/courses/:id" element={<CourseEditor />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  addModuleCalls.length = 0;
  addLessonCalls.length = 0;
  assignCalls.length = 0;
  courseImpl = async () => course({});
  assignmentsImpl = async () => [];
});

describe('CourseEditor', () => {
  it('shows the curriculum tree', async () => {
    renderEditor();
    expect(await screen.findByText('Principles')).toBeInTheDocument();
    expect(screen.getByText('Control the centre')).toBeInTheDocument();
  });

  it('adds a module', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByText('Principles');

    await user.type(screen.getByLabelText('New module title'), 'Tactics');
    await user.click(screen.getByRole('button', { name: 'Add module' }));
    expect(addModuleCalls[0]).toEqual({ courseId: 'c1', body: { title: 'Tactics' } });
  });

  it('adds a lesson to a module', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByText('Principles');

    await user.click(screen.getByRole('button', { name: '+ Lesson' }));
    await user.type(screen.getByLabelText('Lesson title'), 'Open files');
    await user.type(screen.getByLabelText(/Body/), 'Rooks belong on open files.');
    await user.click(screen.getByRole('button', { name: 'Add lesson' }));

    expect(addLessonCalls[0].moduleId).toBe('m1');
    expect(addLessonCalls[0].body).toMatchObject({ title: 'Open files' });
  });

  it('assigns a picked student', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByText('Principles');

    await user.click(await screen.findByLabelText('Faith Wambui'));
    await user.click(screen.getByRole('button', { name: /Assign/ }));
    expect(assignCalls[0]).toEqual({ courseId: 'c1', body: { studentIds: ['stu-1'] } });
  });
});
