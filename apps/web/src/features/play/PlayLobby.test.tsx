import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlayLobby } from './PlayLobby';
import type { Game } from '@/lib/games';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'me', email: 'me@x.com', role: 'STUDENT', isCoach: false } })
}));

// Plain stubs (not vi.fn) so a rejecting call isn't flagged as an unhandled rejection.
const calls: { fn: string; arg?: unknown }[] = [];
let listImpl: () => Promise<{ open: Game[]; mine: Game[] }>;
let createImpl: (color: string) => Promise<Game>;
let joinImpl: (id: string) => Promise<Game>;

vi.mock('@/lib/games', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/games')>();
  return {
    ...actual,
    gamesApi: {
      list: () => {
        calls.push({ fn: 'list' });
        return listImpl();
      },
      create: (color: string) => {
        calls.push({ fn: 'create', arg: color });
        return createImpl(color);
      },
      join: (id: string) => {
        calls.push({ fn: 'join', arg: id });
        return joinImpl(id);
      },
      get: vi.fn()
    }
  };
});

const game = (over: Partial<Game>): Game => ({
  id: 'g1',
  whiteId: 'someone',
  blackId: null,
  white: { id: 'someone', email: 'someone@x.com' },
  black: null,
  status: 'PENDING',
  result: null,
  resultReason: null,
  fen: 'start',
  pgn: '',
  createdAt: '2026-09-06T00:00:00Z',
  endedAt: null,
  ...over
});

function renderLobby() {
  return render(
    <MemoryRouter initialEntries={['/app/play']}>
      <Routes>
        <Route path="/app/play" element={<PlayLobby />} />
        <Route path="/app/play/:id" element={<div>GAME PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  calls.length = 0;
  listImpl = async () => ({ open: [], mine: [] });
  createImpl = async () => game({ id: 'new-game', whiteId: 'me' });
  joinImpl = async () => game({ id: 'joined-game', status: 'ACTIVE' });
});

describe('PlayLobby', () => {
  it('lists your games and open challenges', async () => {
    listImpl = async () => ({
      open: [game({ id: 'o1', white: { id: 's', email: 'stranger@x.com' }, whiteId: 's' })],
      mine: [game({ id: 'm1', status: 'ACTIVE', whiteId: 'me', black: { id: 'opp', email: 'opp@x.com' } })]
    });
    renderLobby();

    expect(await screen.findByText(/vs opp@x\.com/i)).toBeInTheDocument();
    const openPanel = screen.getByText('Open challenges').closest('.panel')!;
    expect(within(openPanel).getByText('stranger@x.com')).toBeInTheDocument();
    expect(within(openPanel).getByRole('button', { name: /join/i })).toBeInTheDocument();
  });

  it('creates a game with the chosen colour and navigates to it', async () => {
    const user = userEvent.setup();
    renderLobby();
    await screen.findByText(/no games in progress/i);

    await user.selectOptions(screen.getByLabelText(/play as/i), 'white');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    expect(calls).toContainEqual({ fn: 'create', arg: 'white' });
    expect(await screen.findByText('GAME PAGE')).toBeInTheDocument();
  });

  it('re-fetches the lists when Refresh is clicked', async () => {
    const user = userEvent.setup();
    renderLobby();
    await screen.findByText(/no games in progress/i);
    const before = calls.filter((c) => c.fn === 'list').length;

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(calls.filter((c) => c.fn === 'list').length).toBeGreaterThan(before);
  });

  it('joins an open challenge and navigates to it', async () => {
    listImpl = async () => ({
      open: [game({ id: 'o1', white: { id: 's', email: 'stranger@x.com' }, whiteId: 's' })],
      mine: []
    });
    const user = userEvent.setup();
    renderLobby();

    await user.click(await screen.findByRole('button', { name: /join/i }));

    expect(calls).toContainEqual({ fn: 'join', arg: 'o1' });
    expect(await screen.findByText('GAME PAGE')).toBeInTheDocument();
  });
});
