import {
  BadRequestException,
  ConflictException,
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

/// A challenge nobody has joined in this long is swept to ABANDONED.
export const PENDING_TTL_MS = 10 * 60 * 1000;

/// Allowed per-side time controls, in seconds. `null` (omitted) = untimed.
export const TIME_CONTROLS = [180, 300, 600, 900, 1200, 1800, 2700] as const;

interface ClockState {
  initialSeconds: number | null;
  whiteMs: number | null;
  blackMs: number | null;
  clockUpdatedAt: Date | null;
}

/// Remaining ms for each side "as of now": the side to move keeps ticking
/// down from clockUpdatedAt, the idle side is frozen at its stored value.
export function clockSnapshot(
  clock: ClockState,
  turn: Color,
  status: string,
  now = Date.now()
): { whiteMs: number | null; blackMs: number | null; running: Color | null } {
  if (clock.initialSeconds == null || clock.whiteMs == null || clock.blackMs == null) {
    return { whiteMs: null, blackMs: null, running: null };
  }
  const running = status === 'ACTIVE' ? turn : null;
  const elapsed =
    running && clock.clockUpdatedAt ? Math.max(0, now - clock.clockUpdatedAt.getTime()) : 0;
  return {
    whiteMs: Math.max(0, clock.whiteMs - (running === 'w' ? elapsed : 0)),
    blackMs: Math.max(0, clock.blackMs - (running === 'b' ? elapsed : 0)),
    running
  };
}

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  private colorOf(game: { whiteId: string | null; blackId: string | null }, userId: string): Color | null {
    if (game.whiteId === userId) return 'w';
    if (game.blackId === userId) return 'b';
    return null;
  }

  /// Lazily retire challenges that have been open too long. Cheap indexed
  /// update; run it on the lobby-adjacent paths so stale rows never surface.
  private expireStale() {
    return this.prisma.game.updateMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
      data: { status: 'ABANDONED', openChallengeOwnerId: null, endedAt: new Date() }
    });
  }

  private isUniqueViolation(err: unknown): boolean {
    return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002';
  }

  /// Replays the stored movetext so the server position is authoritative.
  private load(pgn: string): Chess {
    const chess = new Chess();
    if (pgn && pgn.trim()) chess.loadPgn(pgn);
    return chess;
  }

  // ── Lobby ────────────────────────────────────────────────────────────────

  async create(userId: string, colorPref: ColorPref = 'random', initialSeconds?: number | null) {
    const startedAt = new Date();
    if (initialSeconds != null && !(TIME_CONTROLS as readonly number[]).includes(initialSeconds)) {
      throw new BadRequestException('Unsupported time control');
    }

    // One open challenge per user. Retire the caller's *pre-existing* open
    // challenge (created before this call), then claim the slot on the new
    // row. `openChallengeOwnerId` is unique, so a concurrent create by the
    // same user loses the insert with P2002 — we hand that caller the game
    // that won, leaving exactly one PENDING row.
    await this.prisma.game.updateMany({
      where: { openChallengeOwnerId: userId, status: 'PENDING', createdAt: { lt: startedAt } },
      data: { status: 'ABANDONED', openChallengeOwnerId: null, endedAt: new Date() }
    });

    let color = colorPref;
    if (color === 'random') color = Math.random() < 0.5 ? 'white' : 'black';

    try {
      return await this.prisma.game.create({
        data: {
          whiteId: color === 'white' ? userId : null,
          blackId: color === 'black' ? userId : null,
          status: 'PENDING',
          openChallengeOwnerId: userId,
          initialSeconds: initialSeconds ?? null,
          fen: new Chess().fen(),
          pgn: ''
        },
        include: PLAYER_SELECT
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        const existing = await this.prisma.game.findFirst({
          where: { openChallengeOwnerId: userId, status: 'PENDING' },
          include: PLAYER_SELECT
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  /// Open challenges from other members + the caller's own pending/active games.
  async listForUser(userId: string) {
    await this.expireStale();
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

  /// Internal — no access check. Only call this once the caller has already
  /// been proven a participant (e.g. right after a successful move/resign).
  async get(id: string) {
    const game = await this.prisma.game.findUnique({ where: { id }, include: PLAYER_SELECT });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  /// Access-checked read. A player in the game can always see it; anyone may
  /// see a PENDING game that still has an open seat (it's a public challenge).
  async getForUser(id: string, userId: string) {
    await this.expireStale();
    const game = await this.get(id);
    const isParticipant = game.whiteId === userId || game.blackId === userId;
    const isOpenChallenge = game.status === 'PENDING' && (!game.whiteId || !game.blackId);
    if (!isParticipant && !isOpenChallenge) {
      throw new ForbiddenException('You are not a participant in this game');
    }
    return game;
  }

  async join(id: string, userId: string) {
    await this.expireStale();
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'PENDING') {
      throw new BadRequestException('This game is not open to join');
    }
    if (game.whiteId === userId || game.blackId === userId) {
      throw new BadRequestException('You are already in this game');
    }
    const seat = game.whiteId ? 'blackId' : 'whiteId';

    // Claim the seat atomically: the row must still be PENDING with that seat
    // empty. If a concurrent joiner won it, count is 0. Clearing
    // openChallengeOwnerId frees the creator's "one open challenge" slot.
    // A timed game's clocks start now, with White to move.
    const clockStart =
      game.initialSeconds != null
        ? {
            whiteMs: game.initialSeconds * 1000,
            blackMs: game.initialSeconds * 1000,
            clockUpdatedAt: new Date()
          }
        : {};
    const claimed = await this.prisma.game.updateMany({
      where: { id, status: 'PENDING', [seat]: null },
      data: { [seat]: userId, status: 'ACTIVE', openChallengeOwnerId: null, ...clockStart }
    });
    if (claimed.count === 0) {
      throw new ConflictException('Someone just joined this game');
    }
    return this.prisma.game.findUnique({ where: { id }, include: PLAYER_SELECT });
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

    // Clock: has the mover already run out of time before playing?
    const timed = game.initialSeconds != null && game.clockUpdatedAt != null;
    const now = Date.now();
    let moverRemaining = 0;
    if (timed) {
      const stored = color === 'w' ? game.whiteMs! : game.blackMs!;
      moverRemaining = stored - (now - game.clockUpdatedAt!.getTime());
      if (moverRemaining <= 0) {
        const result: GameOver['result'] = color === 'w' ? 'BLACK_WINS' : 'WHITE_WINS';
        await this.prisma.game.updateMany({
          where: { id, status: 'ACTIVE', revision: game.revision },
          data: {
            status: 'FINISHED',
            result,
            resultReason: 'timeout',
            endedAt: new Date(),
            revision: { increment: 1 },
            ...(color === 'w' ? { whiteMs: 0 } : { blackMs: 0 })
          }
        });
        return { game: await this.get(id), move: null, over: { result, reason: 'timeout' } };
      }
    }

    let played;
    try {
      played = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
    } catch {
      throw new BadRequestException('Illegal move');
    }

    const { over } = inspectPosition(chess);

    // Optimistic lock: only write if the game is still ACTIVE *and* at the
    // revision we read. This also blocks an in-flight move from overwriting
    // the position after the opponent has resigned (resign bumps revision,
    // and moves the status off ACTIVE). On conflict the caller resyncs from
    // the authoritative state.
    const written = await this.prisma.game.updateMany({
      where: { id, status: 'ACTIVE', revision: game.revision },
      data: {
        fen: chess.fen(),
        pgn: chess.pgn(),
        revision: { increment: 1 },
        ...(timed
          ? {
              ...(color === 'w' ? { whiteMs: moverRemaining } : { blackMs: moverRemaining }),
              clockUpdatedAt: new Date(now)
            }
          : {}),
        ...(over
          ? { status: 'FINISHED', result: over.result, resultReason: over.reason, endedAt: new Date() }
          : {})
      }
    });
    if (written.count === 0) {
      throw new ConflictException('The game moved on — refetch and try again');
    }

    return {
      game: await this.get(id),
      move: { san: played.san, from: played.from, to: played.to, color },
      over
    };
  }

  /// Finish a timed game whose running side has run their clock to zero
  /// without moving. Idempotent — a no-op if the position has moved on.
  async flagTimeout(id: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (
      !game ||
      game.status !== 'ACTIVE' ||
      game.initialSeconds == null ||
      game.clockUpdatedAt == null ||
      game.whiteMs == null ||
      game.blackMs == null
    ) {
      return null;
    }
    const turn = this.load(game.pgn).turn();
    const stored = turn === 'w' ? game.whiteMs : game.blackMs;
    if (stored - (Date.now() - game.clockUpdatedAt.getTime()) > 0) return null;

    const result: GameOver['result'] = turn === 'w' ? 'BLACK_WINS' : 'WHITE_WINS';
    const done = await this.prisma.game.updateMany({
      where: { id, status: 'ACTIVE', revision: game.revision },
      data: {
        status: 'FINISHED',
        result,
        resultReason: 'timeout',
        endedAt: new Date(),
        revision: { increment: 1 },
        ...(turn === 'w' ? { whiteMs: 0 } : { blackMs: 0 })
      }
    });
    if (done.count === 0) return null;
    return { game: await this.get(id), over: { result, reason: 'timeout' } };
  }

  async resign(id: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE') throw new BadRequestException('Game is not in progress');

    const color = this.colorOf(game, userId);
    if (!color) throw new ForbiddenException('You are not a player in this game');

    // Conditional: if a move finished the game between the read and here,
    // count is 0 and get() below returns whatever result actually landed.
    // Bumping revision invalidates any move that's in flight on this position.
    await this.prisma.game.updateMany({
      where: { id, status: 'ACTIVE' },
      data: {
        status: 'FINISHED',
        result: color === 'w' ? 'BLACK_WINS' : 'WHITE_WINS',
        resultReason: 'resignation',
        endedAt: new Date(),
        revision: { increment: 1 }
      }
    });
    return this.get(id);
  }

  /// Withdraw your own not-yet-joined challenge.
  async cancel(id: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');

    const color = this.colorOf(game, userId);
    if (!color) throw new ForbiddenException('You are not a player in this game');
    if (game.status !== 'PENDING') {
      throw new BadRequestException('Only a pending challenge can be cancelled');
    }

    // If an opponent joined between the read and here, the row is no longer
    // PENDING — report a conflict rather than abandoning a live game.
    const done = await this.prisma.game.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ABANDONED', openChallengeOwnerId: null, endedAt: new Date() }
    });
    if (done.count === 0) {
      throw new ConflictException('Someone just joined this game');
    }
    return this.get(id);
  }
}
