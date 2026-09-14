import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { ClassroomService } from './classroom.service';

const room = (id: string) => `classroom:${id}`;

interface Participant {
  userId: string;
  name: string;
}

/**
 * Real-time layer for one classroom room. Unlike GamesGateway this isn't a
 * turn-enforced 1v1 game — any connected participant can move on the shared
 * board or load a new position, and everyone (including the sender) is told
 * the resulting state so no client ever has to trust its own optimistic
 * update. Video/audio is a client-side Jitsi embed keyed off the room code;
 * this gateway only owns the board + presence.
 */
@WebSocketGateway({ namespace: '/classroom', cors: { origin: true } })
export class ClassroomGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  // roomId -> socketId -> participant. Presence is best-effort (in memory,
  // lost on server restart) — that's fine, clients rejoin on reconnect.
  private readonly participants = new Map<string, Map<string, Participant>>();

  constructor(
    private readonly classroom: ClassroomService,
    private readonly jwt: JwtService
  ) {}

  private userId(client: Socket): string | null {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!raw) return null;
    try {
      return this.jwt.verify<{ sub: string }>(raw).sub;
    } catch {
      return null;
    }
  }

  private rosterOf(roomId: string): Participant[] {
    return [...(this.participants.get(roomId)?.values() ?? [])];
  }

  private broadcastRoster(roomId: string) {
    this.server?.to(room(roomId)).emit('classroom:participants', this.rosterOf(roomId));
  }

  @SubscribeMessage('classroom:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; name?: string }
  ) {
    const uid = this.userId(client);
    if (!uid) return client.emit('classroom:error', { message: 'Not authenticated' });
    if (!body?.roomId) return;

    let classroomRoom;
    try {
      classroomRoom = await this.classroom.get(body.roomId);
    } catch (err) {
      return client.emit('classroom:error', { message: (err as Error)?.message ?? 'Room not found' });
    }

    client.join(room(body.roomId));
    client.data.roomId = body.roomId;
    if (!this.participants.has(body.roomId)) this.participants.set(body.roomId, new Map());
    this.participants.get(body.roomId)!.set(client.id, { userId: uid, name: body.name?.trim() || 'Guest' });

    client.emit('classroom:state', { room: classroomRoom });
    this.broadcastRoster(body.roomId);
  }

  handleDisconnect(client: Socket) {
    const roomId = client.data?.roomId as string | undefined;
    if (!roomId) return;
    const roster = this.participants.get(roomId);
    if (!roster) return;
    roster.delete(client.id);
    if (roster.size === 0) this.participants.delete(roomId);
    else this.broadcastRoster(roomId);
  }

  @SubscribeMessage('classroom:move')
  async onMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; from: string; to: string; promotion?: string }
  ) {
    if (!this.userId(client)) return client.emit('classroom:error', { message: 'Not authenticated' });
    try {
      const { room: updated, move } = await this.classroom.applyMove(body.roomId, {
        from: body.from,
        to: body.to,
        promotion: body.promotion
      });
      this.server.to(room(body.roomId)).emit('classroom:state', { room: updated, move });
    } catch (err) {
      client.emit('classroom:error', { message: (err as Error)?.message ?? 'Move rejected' });
    }
  }

  @SubscribeMessage('classroom:load')
  async onLoad(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; pgn?: string; fen?: string; label?: string }
  ) {
    if (!this.userId(client)) return client.emit('classroom:error', { message: 'Not authenticated' });
    try {
      const { room: updated, entry } = await this.classroom.loadPosition(body.roomId, {
        pgn: body.pgn,
        fen: body.fen,
        label: body.label
      });
      this.server.to(room(body.roomId)).emit('classroom:state', { room: updated, loadedEntry: entry });
    } catch (err) {
      client.emit('classroom:error', { message: (err as Error)?.message ?? 'Could not load that position' });
    }
  }

  @SubscribeMessage('classroom:select')
  async onSelect(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; entryId: string }
  ) {
    if (!this.userId(client)) return client.emit('classroom:error', { message: 'Not authenticated' });
    try {
      const updated = await this.classroom.selectFromLibrary(body.roomId, body.entryId);
      this.server.to(room(body.roomId)).emit('classroom:state', { room: updated });
    } catch (err) {
      client.emit('classroom:error', { message: (err as Error)?.message ?? 'Could not select that game' });
    }
  }

  @SubscribeMessage('classroom:reset')
  async onReset(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    if (!this.userId(client)) return client.emit('classroom:error', { message: 'Not authenticated' });
    try {
      const updated = await this.classroom.reset(body.roomId);
      this.server.to(room(body.roomId)).emit('classroom:state', { room: updated });
    } catch (err) {
      client.emit('classroom:error', { message: (err as Error)?.message ?? 'Could not reset the board' });
    }
  }

  /// Push authoritative state after a REST-driven mutation (mirrors
  /// GamesGateway.broadcastState).
  broadcastState(roomId: string, classroomRoom: unknown, extra?: Record<string, unknown>) {
    this.server?.to(room(roomId)).emit('classroom:state', { room: classroomRoom, ...extra });
  }

  broadcastClosed(roomId: string) {
    this.server?.to(room(roomId)).emit('classroom:closed');
  }
}
