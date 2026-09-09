import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnalysisBoard } from './AnalysisBoard';

// Stub the board: surface the drop + square-click handlers and the
// computed square-style map so tests can drive and inspect them.
vi.mock('react-chessboard', () => ({
  Chessboard: ({
    onPieceDrop,
    onSquareClick,
    customSquareStyles
  }: {
    onPieceDrop: (a: string, b: string) => boolean;
    onSquareClick?: (sq: string) => void;
    customSquareStyles?: Record<string, unknown>;
  }) => (
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
      <button data-testid="sq-e2" onClick={() => onSquareClick?.('e2')}>
        sq e2
      </button>
      <button data-testid="sq-e4" onClick={() => onSquareClick?.('e4')}>
        sq e4
      </button>
      <div data-testid="styled-squares">{Object.keys(customSquareStyles ?? {}).sort().join(',')}</div>
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

  it('shows legal-target squares when a piece is selected, and click-moves', () => {
    renderBoard();
    // nothing highlighted at the start
    expect(screen.getByTestId('styled-squares').textContent).toBe('');

    fireEvent.click(screen.getByTestId('sq-e2')); // select the e2 pawn
    const styled = screen.getByTestId('styled-squares').textContent ?? '';
    expect(styled.split(',').sort()).toEqual(['e2', 'e3', 'e4']); // from + two targets

    fireEvent.click(screen.getByTestId('sq-e4')); // click a legal target -> move
    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument(); // move-list chip
    expect(screen.getByText(/ply 1\/1/)).toBeInTheDocument();
  });

  it('toggles the sound button label', async () => {
    const user = userEvent.setup();
    renderBoard();
    const btn = screen.getByRole('button', { name: /Sound|Muted/ });
    expect(btn).toHaveTextContent('Sound');
    await user.click(btn);
    expect(btn).toHaveTextContent('Muted');
  });
});
