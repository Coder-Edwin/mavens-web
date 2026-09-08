import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CoursePlayerPage } from './CoursePlayerPage';
import type { MyCourseDetail } from '@/lib/courses';

vi.mock('react-chessboard', () => ({
  Chessboard: ({ position }: { position: string }) => <div data-testid="board">{position}</div>
}));

const completeCalls: string[] = [];
const uncompleteCalls: string[] = [];
let detailImpl: () => Promise<MyCourseDetail>;

vi.mock('@/lib/courses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses')>();
  return {
    ...actual,
    coursesApi: {
      ...actual.coursesApi,
      myCourse: () => detailImpl(),
      completeLesson: (id: string) => {
        completeCalls.push(id);
        return Promise.resolve({} as never);
      },
      uncompleteLesson: (id: string) => {
        uncompleteCalls.push(id);
        return Promise.resolve({} as never);
      }
    }
  };
});

const detail = (completed: string[] = []): MyCourseDetail => ({
  assignment: {
    id: 'a1',
    courseId: 'c1',
    studentId: 'stu-1',
    status: completed.length ? 'IN_PROGRESS' : 'ASSIGNED',
    assignedAt: '2026-01-01T00:00:00Z',
    dueAt: null,
    startedAt: null,
    completedAt: null
  },
  course: {
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
      {
        id: 'm1',
        courseId: 'c1',
        title: 'Principles',
        summary: null,
        position: 0,
        lessons: [
          { id: 'l1', moduleId: 'm1', title: 'Control the centre', body: 'Occupy d4/e4.\n\nDevelop toward the centre.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', videoUrl: null, estimatedMinutes: 10, position: 0 },
          { id: 'l2', moduleId: 'm1', title: 'Develop pieces', body: 'Knights before bishops.', fen: null, videoUrl: null, estimatedMinutes: 8, position: 1 }
        ]
      }
    ]
  },
  completedLessonIds: completed
});

function renderPlayer() {
  return render(
    <MemoryRouter initialEntries={['/app/learn/c1']}>
      <Routes>
        <Route path="/app/learn/:courseId" element={<CoursePlayerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  completeCalls.length = 0;
  uncompleteCalls.length = 0;
  detailImpl = async () => detail([]);
});

describe('CoursePlayerPage', () => {
  it('shows the first lesson with its study board and body paragraphs', async () => {
    renderPlayer();
    expect(await screen.findByText('Control the centre', { selector: '.panel-title' })).toBeInTheDocument();
    expect(screen.getByTestId('board')).toBeInTheDocument();
    expect(screen.getByText('Occupy d4/e4.')).toBeInTheDocument();
  });

  it('switches lessons from the sidebar', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByText('Control the centre', { selector: '.panel-title' });

    await user.click(screen.getByRole('button', { name: /Develop pieces/ }));
    expect(screen.getByText('Knights before bishops.')).toBeInTheDocument();
  });

  it('marks a lesson complete', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByText('Control the centre', { selector: '.panel-title' });

    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(completeCalls).toEqual(['l1']);
  });

  it('offers to un-complete a done lesson', async () => {
    detailImpl = async () => detail(['l1']);
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByText('Control the centre', { selector: '.panel-title' });

    await user.click(screen.getByRole('button', { name: 'Mark not done' }));
    expect(uncompleteCalls).toEqual(['l1']);
  });
});
