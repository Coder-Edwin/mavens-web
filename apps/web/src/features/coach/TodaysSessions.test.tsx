import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TodaysSessions } from './TodaysSessions';
import type { SessionRecord } from '@/lib/sessions';
import type { StudentRecord } from '@/lib/students';

const postCalls: { path: string; body: unknown }[] = [];
let listSessionsImpl: () => Promise<SessionRecord[]>;
let rosterImpl: () => Promise<StudentRecord[]>;

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      post: (path: string, body: unknown) => {
        postCalls.push({ path, body });
        return Promise.resolve({});
      }
    }
  };
});

vi.mock('@/lib/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sessions')>();
  return {
    ...actual,
    sessionsApi: {
      list: () => listSessionsImpl(),
      get: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn()
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

const student = (over: Partial<StudentRecord> = {}): StudentRecord => ({
  id: 'stu-1',
  firstName: 'Faith',
  lastName: 'Wambui',
  level: null,
  dateOfBirth: null,
  homeAddress: null,
  priorExperience: null,
  joinedAt: '2026-01-01T00:00:00Z',
  ...over
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TodaysSessions />
    </MemoryRouter>
  );
}

beforeEach(() => {
  postCalls.length = 0;
  listSessionsImpl = async () => [];
  rosterImpl = async () => [student()];
});

describe('TodaysSessions', () => {
  it('renders the log-a-session form and the weekly agenda', async () => {
    renderPage();
    expect(await screen.findByPlaceholderText(/what did you cover/i)).toBeInTheDocument();
    expect(await screen.findByText('My week')).toBeInTheDocument();
  });

  it('logs a session for the checked students', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Faith Wambui');

    await user.type(screen.getByPlaceholderText(/what did you cover/i), 'Rook endgames');
    await user.click(screen.getByRole('checkbox', { name: /Faith Wambui/i }));
    await user.click(screen.getByRole('button', { name: 'Log session' }));

    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].path).toBe('/sessions');
    expect(postCalls[0].body).toMatchObject({ topic: 'Rook endgames', presentStudentIds: ['stu-1'] });
  });
});
