import { io, type Socket } from 'socket.io-client';
import { api, API_ORIGIN } from './api-client';

export type GameStatus = 'PENDING' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
export type GameResultType = 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW';
export type ColorPref = 'white' | 'black' | 'random';

export interface Player {
  id: string;
  email: string;
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
  createdAt: string;
  endedAt: string | null;
}

export interface MovePayload {
  move: { san: string; from: string; to: string; color: 'w' | 'b' };
  fen: string;
  pgn: string;
  status: GameStatus;
}

export interface OverPayload {
  result: GameResultType;
  reason: string;
}

export const gamesApi = {
  create: (color: ColorPref) => api.post<Game>('/games', { color }),
  list: () => api.get<{ open: Game[]; mine: Game[] }>('/games'),
  get: (id: string) => api.get<Game>(`/games/${id}`),
  join: (id: string) => api.post<Game>(`/games/${id}/join`)
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
    disconnect: () => socket.disconnect()
  };
}

export function resultText(result: GameResultType | null, reason: string | null): string {
  if (!result) return '';
  const who = result === 'WHITE_WINS' ? 'White wins' : result === 'BLACK_WINS' ? 'Black wins' : 'Draw';
  return reason ? `${who} — ${reason.replace(/-/g, ' ')}` : who;
}
