import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Chess } from 'chess.js';
import type { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';

const room = (gameId: string) => `game:${gameId}`;

function clockPayload(game: {
  initialSeconds: number | null;
  whiteMs: number | null;
  blackMs: number | null;
  clockUpdatedAt: Date | null;
}) {
  if (game.initialSeconds == null) return null;
  return {
    initialSeconds: game.initialSeconds,
    whiteMs: game.whiteMs,
    blackMs: game.blackMs,
    updatedAt: game.clockUpdatedAt ? game.clockUpdatedAt.toISOString() : null
  };
}

/**
 * Real-time layer for one game. The server is authoritative — every move is
 * revalidated in GamesService against the stored movetext. Clients only send
 * intents (`from`/`to`) and render whatever `game:move` / `game:state` says.
 * For timed games the server also owns a flag timer per room.
 */
@WebSocketGateway({ namespace: '/games', cors: { origin: true } })
export class GamesGateway {
  @WebSocketServer() server!: Server;

  private readonly flagTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly games: GamesService,
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

  private clearFlagTimer(gameId: string) {
    const t = this.flagTimers.get(gameId);
    if (t) {
      clearTimeout(t);
      this.flagTimers.delete(gameId);
    }
  }

  /// (Re)schedule the flag for the side currently on the clock. Cheap: one
  /// timer per active timed room, replaced on every move / (re)join.
  private async armFlagTimer(gameId: string) {
    this.clearFlagTimer(gameId);
    let game;
    try {
      game = await this.games.get(gameId);
    } catch {
      return;
    }
    if (game.status !== 'ACTIVE' || game.initialSeconds == null || game.clockUpdatedAt == null) return;

    const chess = new Chess();
    if (game.pgn && game.pgn.trim()) chess.loadPgn(game.pgn);
    const turn = chess.turn();
    const stored = (turn === 'w' ? game.whiteMs : game.blackMs) ?? 0;
    const remaining = Math.max(0, stored - (Date.now() - game.clockUpdatedAt.getTime()));

    this.flagTimers.set(
      gameId,
      setTimeout(() => void this.fireFlag(gameId), remaining + 50)
    );
  }

  private async fireFlag(gameId: string) {
    this.flagTimers.delete(gameId);
    const res = await this.games.flagTimeout(gameId);
    if (!res) {
      // Fired early, or a move landed first — re-check.
      void this.armFlagTimer(gameId);
      return;
    }
    this.server.to(room(gameId)).emit('game:over', {
      result: res.over.result,
      reason: res.over.reason
    });
    this.server.to(room(gameId)).emit('game:state', res.game);
  }

  @SubscribeMessage('game:join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { gameId: string }) {
    const uid = this.userId(client);
    if (!uid) return client.emit('game:error', { message: 'Not authenticated' });
    if (!body?.gameId) return;

    let game;
    try {
      game = await this.games.getForUser(body.gameId, uid);
    } catch (err) {
      return client.emit('game:error', { message: (err as Error)?.message ?? 'Game not found' });
    }

    client.join(room(body.gameId));
    this.server.to(room(body.gameId)).emit('game:state', game);
    void this.armFlagTimer(body.gameId);
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

      if (!res.move) {
        // The mover's own clock had already expired — game over on time.
        this.clearFlagTimer(body.gameId);
        this.server.to(room(body.gameId)).emit('game:over', {
          result: res.over?.result,
          reason: res.over?.reason
        });
        this.server.to(room(body.gameId)).emit('game:state', res.game);
        return;
      }

      this.server.to(room(body.gameId)).emit('game:move', {
        move: res.move,
        fen: res.game.fen,
        pgn: res.game.pgn,
        status: res.game.status,
        clock: clockPayload(res.game)
      });
      if (res.over) {
        this.clearFlagTimer(body.gameId);
        this.server.to(room(body.gameId)).emit('game:over', {
          result: res.game.result,
          reason: res.game.resultReason
        });
      } else {
        void this.armFlagTimer(body.gameId);
      }
    } catch (err) {
      client.emit('game:error', { message: (err as Error)?.message ?? 'Move rejected' });
    }
  }

  /// Push the authoritative game state to everyone in the room. Called by the
  /// REST layer after a mutation with no originating socket message.
  broadcastState(gameId: string, game: unknown) {
    this.server?.to(room(gameId)).emit('game:state', game);
  }

  @SubscribeMessage('game:resign')
  async onResign(@ConnectedSocket() client: Socket, @MessageBody() body: { gameId: string }) {
    const uid = this.userId(client);
    if (!uid) return client.emit('game:error', { message: 'Not authenticated' });
    try {
      const game = await this.games.resign(body.gameId, uid);
      this.clearFlagTimer(body.gameId);
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
