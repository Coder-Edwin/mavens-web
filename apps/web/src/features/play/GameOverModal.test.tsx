import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GameOverModal } from './GameOverModal';

function renderModal(props: Partial<Parameters<typeof GameOverModal>[0]> = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(
    <MemoryRouter>
      <GameOverModal
        result="WHITE_WINS"
        reason="checkmate"
        myColor="white"
        pgn="1. e4 e5"
        onClose={onClose}
        {...props}
      />
    </MemoryRouter>
  );
  return { onClose };
}

describe('GameOverModal', () => {
  it('titles by reason and shows the win from my perspective', () => {
    renderModal({ result: 'WHITE_WINS', myColor: 'white', reason: 'checkmate' });
    expect(screen.getByText('Checkmate!')).toBeInTheDocument();
    expect(screen.getByText('You won')).toBeInTheDocument();
  });

  it('shows "You lost" when the other colour wins', () => {
    renderModal({ result: 'WHITE_WINS', myColor: 'black' });
    expect(screen.getByText('You lost')).toBeInTheDocument();
  });

  it('handles timeout and draw reasons and spectator perspective', () => {
    renderModal({ reason: 'timeout', result: 'BLACK_WINS', myColor: null });
    expect(screen.getByText('Time out!')).toBeInTheDocument();
    expect(screen.getByText('Black wins')).toBeInTheDocument();
  });

  it('closes on backdrop / X and links Analyse with the pgn in router state', async () => {
    const { onClose } = renderModal();
    const analyse = screen.getByRole('link', { name: /analyse/i });
    expect(analyse).toHaveAttribute('href', '/app/analysis');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
