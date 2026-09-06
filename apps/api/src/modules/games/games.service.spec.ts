import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Chess } from 'chess.js';
import { GamesService, inspectPosition } from './games.service';
import { PrismaService } from '../../prisma/prisma.service';

const WHITE = 'user-white';
const BLACK = 'user-black';

/** A game record as stored, defaulting to a fresh ACTIVE game between the two users. */
function gameRow(over: Partial<{ id: string; status: string; whiteId: string | null; blackId: string | null; pgn: string }> = {}) {
  return {
    id: 'g1',
    status: 'ACTIVE',
    whiteId: WHITE,
    blackId: BLACK,
    result: null,
    resultReason: null,
    fen: new Chess().fen(),
    pgn: '',
    endedAt: null,
    ...over
  };
}

describe('inspectPosition', () => {
  it('reports the winning side on checkmate (fool’s mate)', () => {
    const c = new Chess();
    ['f3', 'e5', 'g4', 'Qh4#'].forEach((m) => c.move(m));
    expect(inspectPosition(c).over).toEqual({ result: 'BLACK_WINS', reason: 'checkmate' });
  });

  it('reports a draw on stalemate', () => {
    const c = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); // black to move, no legal moves, not in check
    expect(inspectPosition(c).over).toEqual({ result: 'DRAW', reason: 'stalemate' });
  });

  it('returns null for an ongoing position', () => {
    expect(inspectPosition(new Chess()).over).toBeNull();
  });
});

describe('GamesService', () => {
  let service: GamesService;
  let prisma: {
    game: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      game: {
        create: jest.fn((a) => Promise.resolve({ id: 'g1', ...a.data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn((a) => Promise.resolve({ ...gameRow(), ...a.data, id: a.where.id }))
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [GamesService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(GamesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('seats the creator as white when they ask for white', async () => {
      await service.create(WHITE, 'white');
      const data = prisma.game.create.mock.calls[0][0].data;
      expect(data.whiteId).toBe(WHITE);
      expect(data.blackId).toBeNull();
      expect(data.status).toBe('PENDING');
    });

    it('random always seats the creator in exactly one seat', async () => {
      for (let i = 0; i < 10; i += 1) {
        prisma.game.create.mockClear();
        // eslint-disable-next-line no-await-in-loop
        await service.create(WHITE, 'random');
        const d = prisma.game.create.mock.calls[0][0].data;
        expect([d.whiteId, d.blackId].filter((x: unknown) => x === WHITE)).toHaveLength(1);
        expect([d.whiteId, d.blackId].filter((x: unknown) => x === null)).toHaveLength(1);
      }
    });
  });

  describe('join', () => {
    it('fills the empty seat and flips the game to ACTIVE', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow({ status: 'PENDING', blackId: null }));
      await service.join('g1', BLACK);
      expect(prisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { blackId: BLACK, status: 'ACTIVE' } })
      );
    });

    it('rejects joining your own game', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow({ status: 'PENDING', blackId: null }));
      await expect(service.join('g1', WHITE)).rejects.toThrow(BadRequestException);
    });

    it('rejects joining a game that is already full', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow({ status: 'ACTIVE' }));
      await expect(service.join('g1', 'someone-else')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for an unknown game', async () => {
      prisma.game.findUnique.mockResolvedValue(null);
      await expect(service.join('nope', BLACK)).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyMove', () => {
    it('accepts a legal opening move from the side to move and stores the new position', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow());
      const res = await service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' });

      expect(res.move).toMatchObject({ san: 'e4', color: 'w' });
      const data = prisma.game.update.mock.calls[0][0].data;
      expect(data.pgn).toContain('1. e4');
      expect(data.status).toBeUndefined(); // game still going
      expect(res.over).toBeNull();
    });

    it("rejects a move when it is not that player's turn", async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow()); // white to move
      await expect(service.applyMove('g1', BLACK, { from: 'e7', to: 'e5' })).rejects.toThrow(
        /not your turn/i
      );
    });

    it('rejects an illegal move', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow());
      await expect(service.applyMove('g1', WHITE, { from: 'e2', to: 'e5' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects a move from someone who is not in the game', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow());
      await expect(
        service.applyMove('g1', 'stranger', { from: 'e2', to: 'e4' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects moves once the game is finished', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow({ status: 'FINISHED' }));
      await expect(service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('marks the game FINISHED and records the winner on checkmate', async () => {
      // Position one move before Qh4# (fool’s mate); black to move.
      const c = new Chess();
      ['f3', 'e5', 'g4'].forEach((m) => c.move(m));
      prisma.game.findUnique.mockResolvedValue(gameRow({ pgn: c.pgn() }));

      const res = await service.applyMove('g1', BLACK, { from: 'd8', to: 'h4' });

      expect(res.over).toEqual({ result: 'BLACK_WINS', reason: 'checkmate' });
      const data = prisma.game.update.mock.calls[0][0].data;
      expect(data.status).toBe('FINISHED');
      expect(data.result).toBe('BLACK_WINS');
      expect(data.resultReason).toBe('checkmate');
      expect(data.endedAt).toBeInstanceOf(Date);
    });
  });

  describe('resign', () => {
    it('ends the game in favour of the opponent', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow());
      await service.resign('g1', WHITE);
      expect(prisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FINISHED',
            result: 'BLACK_WINS',
            resultReason: 'resignation'
          })
        })
      );
    });

    it('rejects a resign from a non-player', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow());
      await expect(service.resign('g1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('rejects resigning a game that is not in progress', async () => {
      prisma.game.findUnique.mockResolvedValue(gameRow({ status: 'PENDING', blackId: null }));
      await expect(service.resign('g1', WHITE)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listForUser', () => {
    it('asks for open challenges from others and the caller’s own live games', async () => {
      await service.listForUser(WHITE);
      const [openArgs, mineArgs] = prisma.game.findMany.mock.calls.map((c) => c[0]);
      expect(openArgs.where).toMatchObject({
        status: 'PENDING',
        whiteId: { not: WHITE },
        blackId: { not: WHITE }
      });
      expect(mineArgs.where.OR).toEqual([{ whiteId: WHITE }, { blackId: WHITE }]);
    });
  });
});
