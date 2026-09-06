import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';

const room = (gameId: string) => `game:${gameId}`;

/**
 * Real-time layer for one game. The server is authoritative — every move is
 * revalidated in GamesService against the stored movetext. Clients only send
 * intents (`from`/`to`) and render whatever `game:move` / `game:state` says.
 */
@WebSocketGateway({ namespace: '/games', cors: { origin: true } })
export class GamesGateway {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly games: GamesService,
    private readonly jwt: JwtService
  ) {}

  /// The socket carries the same JWT as the REST client, in handshake.auth.
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

  @SubscribeMessage('game:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    if (!body?.gameId) return;
    client.join(room(body.gameId));
    try {
      const game = await this.games.get(body.gameId);
      // Broadcast to the whole room so both players' seat/status view refreshes.
      this.server.to(room(body.gameId)).emit('game:state', game);
    } catch (err) {
      client.emit('game:error', { message: (err as Error)?.message ?? 'Game not found' });
    }
  }

  @SubscribeMessage('game:move')
  async onMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; from: string; to: string; promotion?: string }
  ) {
    const uid = this.userId(client);
    if (!uid) return client.emit('game:error', { message: 'Not authenticated' });
    try {
      const res = await this.games.applyMove(body.gameId, uid, {
        from: body.from,
        to: body.to,
        promotion: body.promotion
      });
      this.server.to(room(body.gameId)).emit('game:move', {
        move: res.move,
        fen: res.game.fen,
        pgn: res.game.pgn,
        status: res.game.status
      });
      if (res.over) {
        this.server.to(room(body.gameId)).emit('game:over', {
          result: res.game.result,
          reason: res.game.resultReason
        });
      }
    } catch (err) {
      client.emit('game:error', { message: (err as Error)?.message ?? 'Move rejected' });
    }
  }

  @SubscribeMessage('game:resign')
  async onResign(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const uid = this.userId(client);
    if (!uid) return client.emit('game:error', { message: 'Not authenticated' });
    try {
      const game = await this.games.resign(body.gameId, uid);
      this.server.to(room(body.gameId)).emit('game:over', {
        result: game.result,
        reason: game.resultReason
      });
      this.server.to(room(body.gameId)).emit('game:state', await this.games.get(body.gameId));
    } catch (err) {
      client.emit('game:error', { message: (err as Error)?.message ?? 'Could not resign' });
    }
  }
}
