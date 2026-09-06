import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Chess } from 'chess.js';
import { PrismaService } from '../../prisma/prisma.service';

type Color = 'w' | 'b';
type ColorPref = 'white' | 'black' | 'random';

const PLAYER_SELECT = {
  white: { select: { id: true, email: true } },
  black: { select: { id: true, email: true } }
} as const;

interface GameOver {
  result: 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW';
  reason: string;
}

/// Reads the side to move + game-over state from a chess.js position.
export function inspectPosition(chess: Chess): { turn: Color; over: GameOver | null } {
  const turn = chess.turn();
  let over: GameOver | null = null;
  if (chess.isCheckmate()) {
    // The side to move is the one that's mated → the other side wins.
    over = { result: turn === 'w' ? 'BLACK_WINS' : 'WHITE_WINS', reason: 'checkmate' };
  } else if (chess.isStalemate()) {
    over = { result: 'DRAW', reason: 'stalemate' };
  } else if (chess.isInsufficientMaterial()) {
    over = { result: 'DRAW', reason: 'insufficient-material' };
  } else if (chess.isThreefoldRepetition()) {
    over = { result: 'DRAW', reason: 'threefold' };
  } else if (chess.isDraw()) {
    over = { result: 'DRAW', reason: 'fifty-move' };
  }
  return { turn, over };
}

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  private colorOf(game: { whiteId: string | null; blackId: string | null }, userId: string): Color | null {
    if (game.whiteId === userId) return 'w';
    if (game.blackId === userId) return 'b';
    return null;
  }

  /// Replays the stored movetext so the server position is authoritative.
  private load(pgn: string): Chess {
    const chess = new Chess();
    if (pgn && pgn.trim()) chess.loadPgn(pgn);
    return chess;
  }

  // ── Lobby ────────────────────────────────────────────────────────────────

  async create(userId: string, colorPref: ColorPref = 'random') {
    let color = colorPref;
    if (color === 'random') color = Math.random() < 0.5 ? 'white' : 'black';

    return this.prisma.game.create({
      data: {
        whiteId: color === 'white' ? userId : null,
        blackId: color === 'black' ? userId : null,
        status: 'PENDING',
        fen: new Chess().fen(),
        pgn: ''
      },
      include: PLAYER_SELECT
    });
  }

  /// Open challenges from other members + the caller's own pending/active games.
  async listForUser(userId: string) {
    const [open, mine] = await Promise.all([
      this.prisma.game.findMany({
        where: { status: 'PENDING', whiteId: { not: userId }, blackId: { not: userId } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: PLAYER_SELECT
      }),
      this.prisma.game.findMany({
        where: {
          status: { in: ['PENDING', 'ACTIVE'] },
          OR: [{ whiteId: userId }, { blackId: userId }]
        },
        orderBy: { updatedAt: 'desc' },
        include: PLAYER_SELECT
      })
    ]);
    return { open, mine };
  }

  async get(id: string) {
    const game = await this.prisma.game.findUnique({ where: { id }, include: PLAYER_SELECT });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  async join(id: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'PENDING') {
      throw new BadRequestException('This game is not open to join');
    }
    if (game.whiteId === userId || game.blackId === userId) {
      throw new BadRequestException('You are already in this game');
    }
    const seat = game.whiteId ? 'blackId' : 'whiteId';
    return this.prisma.game.update({
      where: { id },
      data: { [seat]: userId, status: 'ACTIVE' },
      include: PLAYER_SELECT
    });
  }

  // ── Play ─────────────────────────────────────────────────────────────────

  async applyMove(
    id: string,
    userId: string,
    move: { from: string; to: string; promotion?: string }
  ) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE') throw new BadRequestException('Game is not in progress');

    const color = this.colorOf(game, userId);
    if (!color) throw new ForbiddenException('You are not a player in this game');

    const chess = this.load(game.pgn);
    if (chess.turn() !== color) throw new BadRequestException("It's not your turn");

    let played;
    try {
      played = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
    } catch {
      throw new BadRequestException('Illegal move');
    }

    const { over } = inspectPosition(chess);
    const updated = await this.prisma.game.update({
      where: { id },
      data: {
        fen: chess.fen(),
        pgn: chess.pgn(),
        ...(over
          ? { status: 'FINISHED', result: over.result, resultReason: over.reason, endedAt: new Date() }
          : {})
      },
      include: PLAYER_SELECT
    });

    return {
      game: updated,
      move: { san: played.san, from: played.from, to: played.to, color },
      over
    };
  }

  async resign(id: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE') throw new BadRequestException('Game is not in progress');

    const color = this.colorOf(game, userId);
    if (!color) throw new ForbiddenException('You are not a player in this game');

    return this.prisma.game.update({
      where: { id },
      data: {
        status: 'FINISHED',
        result: color === 'w' ? 'BLACK_WINS' : 'WHITE_WINS',
        resultReason: 'resignation',
        endedAt: new Date()
      },
      include: PLAYER_SELECT
    });
  }
}
