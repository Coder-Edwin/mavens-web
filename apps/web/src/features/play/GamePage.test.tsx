import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GamePage } from './GamePage';
import type { Game, GameSocketHandlers } from '@/lib/games';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'white-user', email: 'w@x.com', role: 'STUDENT', isCoach: false } })
}));

// Stub the board: expose the drop handler as a button so tests can fire a move.
vi.mock('react-chessboard', () => ({
  Chessboard: ({ onPieceDrop, arePiecesDraggable }: { onPieceDrop: (a: string, b: string) => boolean; arePiecesDraggable: boolean }) => (
    <button data-testid="drop-e2e4" disabled={!arePiecesDraggable} onClick={() => onPieceDrop('e2', 'e4')}>
      board
    </button>
  )
}));

const socketMoves: { from: string; to: string }[] = [];
let capturedHandlers: GameSocketHandlers = {};
let getImpl: () => Promise<Game>;

vi.mock('@/lib/games', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/games')>();
  return {
    ...actual,
    gamesApi: { get: () => getImpl(), list: vi.fn(), create: vi.fn(), join: vi.fn() },
    connectGameSocket: (_id: string, handlers: GameSocketHandlers) => {
      capturedHandlers = handlers;
      return {
        move: (m: { from: string; to: string }) => socketMoves.push(m),
        resign: vi.fn(),
        disconnect: vi.fn()
      };
    }
  };
});

const activeGame: Game = {
  id: 'g1',
  whiteId: 'white-user',
  blackId: 'black-user',
  white: { id: 'white-user', email: 'w@x.com' },
  black: { id: 'black-user', email: 'b@x.com' },
  status: 'ACTIVE',
  result: null,
  resultReason: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '',
  createdAt: '2026-09-06T00:00:00Z',
  endedAt: null
};

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/app/play/g1']}>
      <Routes>
        <Route path="/app/play/:id" element={<GamePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  socketMoves.length = 0;
  capturedHandlers = {};
  getImpl = async () => activeGame;
});

describe('GamePage', () => {
  it('shows both players and a resign control for an active game', async () => {
    renderGame();
    expect(await screen.findByText('w@x.com')).toBeInTheDocument();
    expect(screen.getByText('b@x.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resign/i })).toBeInTheDocument();
  });

  it('sends a legal move over the socket when it is your turn', async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByText('w@x.com');

    await user.click(screen.getByTestId('drop-e2e4'));

    expect(socketMoves).toEqual([{ from: 'e2', to: 'e4', promotion: 'q' }]);
  });

  it('renders the incoming move from the server in the move list', async () => {
    renderGame();
    await screen.findByText('w@x.com');

    capturedHandlers.onMove?.({
      move: { san: 'e4', from: 'e2', to: 'e4', color: 'w' },
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      pgn: '1. e4',
      status: 'ACTIVE'
    });

    expect(await screen.findByText('e4')).toBeInTheDocument();
  });

  it('shows a result banner when the game ends', async () => {
    renderGame();
    await screen.findByText('w@x.com');

    capturedHandlers.onOver?.({ result: 'WHITE_WINS', reason: 'checkmate' });

    expect(await screen.findByText(/white wins — checkmate/i)).toBeInTheDocument();
  });

  it('shows a waiting notice for a game with no opponent yet', async () => {
    getImpl = async () => ({ ...activeGame, status: 'PENDING', blackId: null, black: null });
    renderGame();
    expect(await screen.findByText(/waiting for an opponent/i)).toBeInTheDocument();
  });
});
