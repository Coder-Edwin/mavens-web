import { io, type Socket } from 'socket.io-client';
import { api, API_ORIGIN } from './api-client';

export type GameStatus = 'PENDING' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
export type GameResultType = 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW';
export type ColorPref = 'white' | 'black' | 'random';

export interface Player {
  id: string;
  email: string;
}

export interface ClockPayload {
  initialSeconds: number;
  whiteMs: number | null;
  blackMs: number | null;
  updatedAt: string | null;
}

export interface Game {
  id: string;
  whiteId: string | null;
  blackId: string | null;
  white: Player | null;
  black: Player | null;
  status: GameStatus;
  result: GameResultType | null;
  resultReason: string | null;
  fen: string;
  pgn: string;
  initialSeconds: number | null;
  whiteMs: number | null;
  blackMs: number | null;
  clockUpdatedAt: string | null;
  createdAt: string;
  endedAt: string | null;
}

export interface MovePayload {
  move: { san: string; from: string; to: string; color: 'w' | 'b' };
  fen: string;
  pgn: string;
  status: GameStatus;
  clock: ClockPayload | null;
}

// Supported per-side time controls, seconds. Mirrors TIME_CONTROLS on the API.
export const TIME_CONTROLS: { seconds: number; label: string }[] = [
  { seconds: 180, label: '3 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
  { seconds: 900, label: '15 min' },
  { seconds: 1200, label: '20 min' },
  { seconds: 1800, label: '30 min' },
  { seconds: 2700, label: '45 min' }
];

/** Live remaining ms per side, given the game state and "now". */
export function liveClock(
  game: Pick<Game, 'status' | 'fen' | 'whiteMs' | 'blackMs' | 'clockUpdatedAt' | 'initialSeconds'>,
  now = Date.now()
): { whiteMs: number | null; blackMs: number | null; running: 'w' | 'b' | null } {
  if (game.initialSeconds == null || game.whiteMs == null || game.blackMs == null) {
    return { whiteMs: null, blackMs: null, running: null };
  }
  const turn = game.fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const running = game.status === 'ACTIVE' ? turn : null;
  const elapsed =
    running && game.clockUpdatedAt
      ? Math.max(0, now - new Date(game.clockUpdatedAt).getTime())
      : 0;
  return {
    whiteMs: Math.max(0, game.whiteMs - (running === 'w' ? elapsed : 0)),
    blackMs: Math.max(0, game.blackMs - (running === 'b' ? elapsed : 0)),
    running
  };
}

export function formatClock(ms: number | null): string {
  if (ms == null) return '--:--';
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface OverPayload {
  result: GameResultType;
  reason: string;
}

export const gamesApi = {
  create: (color: ColorPref, initialSeconds?: number | null) =>
    api.post<Game>('/games', { color, ...(initialSeconds ? { initialSeconds } : {}) }),
  list: () => api.get<{ open: Game[]; mine: Game[] }>('/games'),
  get: (id: string) => api.get<Game>(`/games/${id}`),
  join: (id: string) => api.post<Game>(`/games/${id}/join`),
  cancel: (id: string) => api.post<Game>(`/games/${id}/cancel`)
};

export interface GameSocketHandlers {
  onState?: (game: Game) => void;
  onMove?: (payload: MovePayload) => void;
  onOver?: (payload: OverPayload) => void;
  onError?: (payload: { message: string }) => void;
}

export interface GameSocket {
  move: (m: { from: string; to: string; promotion?: string }) => void;
  resign: () => void;
  /** Re-announce presence in the room — e.g. after joining a shared game,
   *  so the other player receives a fresh `game:state`. */
  rejoin: () => void;
  disconnect: () => void;
}

/// Opens a socket to the /games namespace, joins the game's room, and wires
/// the handlers. The server is authoritative — callers should render whatever
/// `onState` / `onMove` reports rather than trusting local state.
export function connectGameSocket(gameId: string, handlers: GameSocketHandlers): GameSocket {
  const token = localStorage.getItem('mavens_token');
  const socket: Socket = io(`${API_ORIGIN}/games`, {
    auth: { token },
    transports: ['websocket']
  });

  socket.on('connect', () => socket.emit('game:join', { gameId }));
  if (handlers.onState) socket.on('game:state', handlers.onState);
  if (handlers.onMove) socket.on('game:move', handlers.onMove);
  if (handlers.onOver) socket.on('game:over', handlers.onOver);
  if (handlers.onError) socket.on('game:error', handlers.onError);

  return {
    move: (m) => socket.emit('game:move', { gameId, ...m }),
    resign: () => socket.emit('game:resign', { gameId }),
    rejoin: () => socket.emit('game:join', { gameId }),
    disconnect: () => socket.disconnect()
  };
}

export function resultText(result: GameResultType | null, reason: string | null): string {
  if (!result) return '';
  const who = result === 'WHITE_WINS' ? 'White wins' : result === 'BLACK_WINS' ? 'Black wins' : 'Draw';
  return reason ? `${who} — ${reason.replace(/-/g, ' ')}` : who;
}
