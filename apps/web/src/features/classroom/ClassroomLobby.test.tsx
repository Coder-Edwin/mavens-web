import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ClassroomLobby } from './ClassroomLobby';
import type { ClassroomRoom } from '@/lib/classroom';

let authUser = { id: 'u1', email: 'coach@x.com', role: 'COACH' as const, isCoach: true };
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: authUser })
}));

const calls: { fn: string; arg?: unknown }[] = [];
let createImpl: (title?: string) => Promise<ClassroomRoom>;
let getByCodeImpl: (code: string) => Promise<ClassroomRoom>;

vi.mock('@/lib/classroom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/classroom')>();
  return {
    ...actual,
    classroomApi: {
      create: (title?: string) => {
        calls.push({ fn: 'create', arg: title });
        return createImpl(title);
      },
      getByCode: (code: string) => {
        calls.push({ fn: 'getByCode', arg: code });
        return getByCodeImpl(code);
      }
    }
  };
});

const room = (over: Partial<ClassroomRoom> = {}): ClassroomRoom => ({
  id: 'room-1',
  code: 'ABC123',
  title: null,
  hostUserId: 'u1',
  status: 'OPEN',
  fen: 'start',
  pgn: '',
  library: [],
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
  closedAt: null,
  ...over
});

function renderLobby() {
  return render(
    <MemoryRouter initialEntries={['/app/classroom']}>
      <Routes>
        <Route path="/app/classroom" element={<ClassroomLobby />} />
        <Route path="/app/classroom/:id" element={<div>ROOM PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  calls.length = 0;
  authUser = { id: 'u1', email: 'coach@x.com', role: 'COACH', isCoach: true };
  createImpl = async (title) => room({ title: title ?? null });
  getByCodeImpl = async () => room();
});

describe('ClassroomLobby', () => {
  it('lets a coach start a new room and navigates straight into it', async () => {
    const user = userEvent.setup();
    renderLobby();

    await user.click(screen.getByRole('button', { name: /new room/i }));

    expect(calls).toContainEqual({ fn: 'create', arg: undefined });
    expect(await screen.findByText('ROOM PAGE')).toBeInTheDocument();
  });

  it('joins an existing room by code', async () => {
    const user = userEvent.setup();
    renderLobby();

    await user.type(screen.getByLabelText(/room code/i), 'xyz789');
    await user.click(screen.getByRole('button', { name: /join/i }));

    expect(calls).toContainEqual({ fn: 'getByCode', arg: 'XYZ789' });
    expect(await screen.findByText('ROOM PAGE')).toBeInTheDocument();
  });

  it('shows an error when the code does not match any room', async () => {
    getByCodeImpl = async () => {
      throw new Error('No classroom with that code');
    };
    const user = userEvent.setup();
    renderLobby();

    await user.type(screen.getByLabelText(/room code/i), 'GHOST1');
    await user.click(screen.getByRole('button', { name: /join/i }));

    expect(await screen.findByText(/no classroom with that code/i)).toBeInTheDocument();
  });

  it('hides the "New room" control for a student and points them to their coach instead', () => {
    authUser = { id: 'u2', email: 'student@x.com', role: 'STUDENT' as never, isCoach: false };
    renderLobby();
    expect(screen.queryByRole('button', { name: /new room/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ask your coach/i)).toBeInTheDocument();
  });
});
