import { io, type Socket } from 'socket.io-client';
import { api, API_ORIGIN } from './api-client';

export type ClassroomRoomStatus = 'OPEN' | 'CLOSED';

export interface ClassroomLibraryEntry {
  id: string;
  label: string;
  pgn: string;
}

export interface ClassroomRoom {
  id: string;
  code: string;
  title: string | null;
  hostUserId: string;
  status: ClassroomRoomStatus;
  fen: string;
  pgn: string;
  library: ClassroomLibraryEntry[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface ClassroomStatePayload {
  room: ClassroomRoom;
  move?: { san: string; from: string; to: string };
  loadedEntry?: ClassroomLibraryEntry;
}

export interface ClassroomParticipant {
  userId: string;
  name: string;
}

export const classroomApi = {
  create: (title?: string) => api.post<ClassroomRoom>('/classroom', title ? { title } : {}),
  getByCode: (code: string) => api.get<ClassroomRoom>(`/classroom/code/${encodeURIComponent(code)}`),
  get: (id: string) => api.get<ClassroomRoom>(`/classroom/${id}`),
  close: (id: string) => api.post<ClassroomRoom>(`/classroom/${id}/close`),
  load: (id: string, body: { pgn?: string; fen?: string; label?: string }) =>
    api.post<ClassroomRoom>(`/classroom/${id}/load`, body),
  selectFromLibrary: (id: string, entryId: string) =>
    api.post<ClassroomRoom>(`/classroom/${id}/library/${encodeURIComponent(entryId)}/select`),
  removeFromLibrary: (id: string, entryId: string) =>
    api.del<ClassroomRoom>(`/classroom/${id}/library/${encodeURIComponent(entryId)}`),
  reset: (id: string) => api.post<ClassroomRoom>(`/classroom/${id}/reset`)
};

export interface ClassroomSocketHandlers {
  onState?: (payload: ClassroomStatePayload) => void;
  onParticipants?: (participants: ClassroomParticipant[]) => void;
  onClosed?: () => void;
  onError?: (payload: { message: string }) => void;
}

export interface ClassroomSocket {
  move: (m: { from: string; to: string; promotion?: string }) => void;
  loadPosition: (m: { pgn?: string; fen?: string; label?: string }) => void;
  selectFromLibrary: (entryId: string) => void;
  reset: () => void;
  disconnect: () => void;
}

/// Opens a socket to the /classroom namespace and joins the room. Unlike a
/// Play game, every participant's actions (move, load, select, reset) are
/// broadcast to everyone including the sender — the server is still
/// authoritative, but there's no "my turn" gate to optimise around.
export function connectClassroomSocket(
  roomId: string,
  name: string,
  handlers: ClassroomSocketHandlers
): ClassroomSocket {
  const token = localStorage.getItem('mavens_token');
  const socket: Socket = io(`${API_ORIGIN}/classroom`, {
    auth: { token },
    transports: ['websocket']
  });

  socket.on('connect', () => socket.emit('classroom:join', { roomId, name }));
  if (handlers.onState) socket.on('classroom:state', handlers.onState);
  if (handlers.onParticipants) socket.on('classroom:participants', handlers.onParticipants);
  if (handlers.onClosed) socket.on('classroom:closed', handlers.onClosed);
  if (handlers.onError) socket.on('classroom:error', handlers.onError);

  return {
    move: (m) => socket.emit('classroom:move', { roomId, ...m }),
    loadPosition: (m) => socket.emit('classroom:load', { roomId, ...m }),
    selectFromLibrary: (entryId) => socket.emit('classroom:select', { roomId, entryId }),
    reset: () => socket.emit('classroom:reset', { roomId }),
    disconnect: () => socket.disconnect()
  };
}

/// A Jitsi Meet room name derived from the classroom's own code — namespaced
/// so it's very unlikely to collide with a stranger's public meet.jit.si
/// room. No account/API key needed; the client just embeds this room.
export function jitsiRoomName(code: string): string {
  return `MavensClassroom-${code}`;
}
