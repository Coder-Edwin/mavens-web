import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LichessFeedPage } from './LichessFeedPage';
import type { LichessTv } from '@/lib/lichess';

let tvImpl: () => Promise<LichessTv>;
const gamePgnCalls: string[] = [];

vi.mock('@/lib/lichess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lichess')>();
  return {
    ...actual,
    lichessApi: {
      tv: () => tvImpl(),
      gamePgn: (id: string) => {
        gamePgnCalls.push(id);
        return Promise.resolve({ pgn: '1. e4 e5 *' });
      }
    }
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/lichess']}>
      <Routes>
        <Route path="/app/lichess" element={<LichessFeedPage />} />
        <Route path="/app/analysis" element={<div>ANALYSIS PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  gamePgnCalls.length = 0;
  tvImpl = async () => ({
    Bullet: { gameId: 'abcd1234', color: 'white', rating: 2700, user: { id: 'a', name: 'Magnus', title: 'GM' } },
    Blitz: { gameId: 'wxyz5678', color: 'black', rating: 2500, user: { id: 'b', name: 'Hikaru' } },
    Horde: {} // no gameId -> filtered out
  });
});

describe('LichessFeedPage', () => {
  it('lists the current top game per channel, most popular first', async () => {
    renderPage();
    const bulletCard = await screen.findByText('GM Magnus (2700)');
    expect(bulletCard).toBeInTheDocument();
    expect(screen.getByText('Hikaru (2500)')).toBeInTheDocument();
    expect(screen.queryByText('Horde')).not.toBeInTheDocument();
  });

  it('opens a game in the analysis board', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('GM Magnus (2700)');

    const analyseButtons = screen.getAllByRole('button', { name: 'Analyse' });
    await user.click(analyseButtons[0]);

    expect(gamePgnCalls).toEqual(['abcd1234']);
    expect(await screen.findByText('ANALYSIS PAGE')).toBeInTheDocument();
  });

  it('shows an empty state when lichess has nothing live', async () => {
    tvImpl = async () => ({});
    renderPage();
    expect(await screen.findByText(/didn.t report any games/i)).toBeInTheDocument();
  });
});
