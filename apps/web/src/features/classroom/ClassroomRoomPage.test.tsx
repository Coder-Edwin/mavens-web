import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ClassroomRoomPage } from './ClassroomRoomPage';
import type { ClassroomRoom, ClassroomSocketHandlers } from '@/lib/classroom';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'host-1', email: 'coach@x.com', role: 'COACH', isCoach: true } })
}));

// Stub the board: expose position + the drop handler for the tests to drive.
vi.mock('react-chessboard', () => ({
  Chessboard: ({
    position,
    onPieceDrop,
    arePiecesDraggable
  }: {
    position: string;
    onPieceDrop: (a: string, b: string) => boolean;
    arePiecesDraggable: boolean;
  }) => (
    <div>
      <div data-testid="fen">{position}</div>
      <button data-testid="drop-e2e4" disabled={!arePiecesDraggable} onClick={() => onPieceDrop('e2', 'e4')}>
        board
      </button>
    </div>
  )
}));

const socketCalls: { fn: string; arg?: unknown }[] = [];
let capturedHandlers: ClassroomSocketHandlers = {};
let getImpl: () => Promise<ClassroomRoom>;
const restCalls: { fn: string; arg?: unknown }[] = [];

vi.mock('@/lib/classroom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/classroom')>();
  return {
    ...actual,
    classroomApi: {
      get: () => getImpl(),
      close: (id: string) => {
        restCalls.push({ fn: 'close', arg: id });
        return Promise.resolve({} as ClassroomRoom);
      },
      removeFromLibrary: (id: string, entryId: string) => {
        restCalls.push({ fn: 'removeFromLibrary', arg: { id, entryId } });
        return Promise.resolve({} as ClassroomRoom);
      }
    },
    connectClassroomSocket: (_id: string, _name: string, handlers: ClassroomSocketHandlers) => {
      capturedHandlers = handlers;
      return {
        move: (m: unknown) => socketCalls.push({ fn: 'move', arg: m }),
        loadPosition: (m: unknown) => socketCalls.push({ fn: 'loadPosition', arg: m }),
        selectFromLibrary: (entryId: string) => socketCalls.push({ fn: 'selectFromLibrary', arg: entryId }),
        reset: () => socketCalls.push({ fn: 'reset' }),
        disconnect: vi.fn()
      };
    }
  };
});

const room = (over: Partial<ClassroomRoom> = {}): ClassroomRoom => ({
  id: 'room-1',
  code: 'ABC123',
  title: 'Saturday Novices',
  hostUserId: 'host-1',
  status: 'OPEN',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '',
  library: [],
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
  closedAt: null,
  ...over
});

function renderRoom() {
  return render(
    <MemoryRouter initialEntries={['/app/classroom/room-1']}>
      <Routes>
        <Route path="/app/classroom" element={<div>LOBBY</div>} />
        <Route path="/app/classroom/:id" element={<ClassroomRoomPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  socketCalls.length = 0;
  restCalls.length = 0;
  capturedHandlers = {};
  getImpl = async () => room();
});

describe('ClassroomRoomPage', () => {
  it('shows the room title and code', async () => {
    renderRoom();
    expect(await screen.findByText('Saturday Novices')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('sends a legal move over the socket while the room is open', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Saturday Novices');

    await user.click(screen.getByTestId('drop-e2e4'));

    expect(socketCalls).toContainEqual({ fn: 'move', arg: { from: 'e2', to: 'e4', promotion: 'q' } });
  });

  it('disables the board once the room is closed', async () => {
    getImpl = async () => room({ status: 'CLOSED' });
    renderRoom();
    await screen.findByText('Saturday Novices');
    expect(screen.getByTestId('drop-e2e4')).toBeDisabled();
  });

  it('shows a closed banner when the host ends the room', async () => {
    renderRoom();
    await screen.findByText('Saturday Novices');

    capturedHandlers.onClosed?.();

    expect(await screen.findByText(/this classroom has been closed/i)).toBeInTheDocument();
  });

  it('lets the host close the room', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoom();
    await screen.findByText('Saturday Novices');

    await user.click(screen.getByRole('button', { name: /close room/i }));

    expect(restCalls).toContainEqual({ fn: 'close', arg: 'room-1' });
  });

  it('loads a pasted FEN over the socket', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Saturday Novices');

    const fen = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';
    await user.type(screen.getByPlaceholderText(/paste a fen or pgn/i), fen);
    await user.click(screen.getByRole('button', { name: /^load$/i }));

    expect(socketCalls).toContainEqual({ fn: 'loadPosition', arg: { fen, label: undefined } });
  });

  it('lists participants reported over the socket', async () => {
    renderRoom();
    await screen.findByText('Saturday Novices');

    capturedHandlers.onParticipants?.([{ userId: 'host-1', name: 'coach@x.com' }]);

    expect(await screen.findByText('coach@x.com')).toBeInTheDocument();
  });

  it('lets a participant switch to a library entry', async () => {
    getImpl = async () => room({ library: [{ id: 'e1', label: 'K+K ending', pgn: '' }] });
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('K+K ending');

    await user.click(screen.getByRole('button', { name: 'Use' }));

    expect(socketCalls).toContainEqual({ fn: 'selectFromLibrary', arg: 'e1' });
  });
});
