import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnalysisBoard } from './AnalysisBoard';

// Stub the board: expose a couple of legal opening drops as buttons.
vi.mock('react-chessboard', () => ({
  Chessboard: ({ onPieceDrop }: { onPieceDrop: (a: string, b: string) => boolean }) => (
    <div>
      <button data-testid="drop-e2e4" onClick={() => onPieceDrop('e2', 'e4')}>
        board drop 1
      </button>
      <button data-testid="drop-e7e5" onClick={() => onPieceDrop('e7', 'e5')}>
        board drop 2
      </button>
      <button data-testid="drop-illegal" onClick={() => onPieceDrop('e2', 'e9')}>
        board drop illegal
      </button>
    </div>
  )
}));

function renderBoard() {
  return render(
    <MemoryRouter>
      <AnalysisBoard />
    </MemoryRouter>
  );
}

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
  // @ts-expect-error cleanup
  delete navigator.clipboard;
});

describe('AnalysisBoard', () => {
  it('records legal moves in the move list and ignores illegal ones', async () => {
    renderBoard();
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    fireEvent.click(screen.getByTestId('drop-e7e5'));
    fireEvent.click(screen.getByTestId('drop-illegal'));

    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'e5' })).toBeInTheDocument();
    expect(screen.getByText(/ply 2\/2/)).toBeInTheDocument();
  });

  it('steps backward and forward through the moves', async () => {
    const user = userEvent.setup();
    renderBoard();
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    fireEvent.click(screen.getByTestId('drop-e7e5'));

    await user.click(screen.getByRole('button', { name: '◀' }));
    expect(screen.getByText(/ply 1\/2/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '⏮' }));
    expect(screen.getByText(/ply 0\/2/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '⏭' }));
    expect(screen.getByText(/ply 2\/2/)).toBeInTheDocument();
  });

  it('loads a PGN', async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.type(screen.getByPlaceholderText(/Paste a FEN or PGN/), '1. d4 d5 2. c4 e6');
    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(await screen.findByText(/Loaded 4 half-moves from PGN/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'd4' })).toBeInTheDocument();
    expect(screen.getByText(/ply 4\/4/)).toBeInTheDocument();
  });

  it('rejects junk in the loader', async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.type(screen.getByPlaceholderText(/Paste a FEN or PGN/), 'not a chess anything');
    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(await screen.findByText(/neither a valid FEN nor a PGN/)).toBeInTheDocument();
  });

  it('copies the current FEN', async () => {
    renderBoard();
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    // fireEvent (not userEvent) so userEvent's own clipboard stub doesn't shadow ours
    fireEvent.click(screen.getByRole('button', { name: 'Copy FEN' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('4P3'));
  });
});
