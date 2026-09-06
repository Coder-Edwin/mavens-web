import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
import { Chess } from 'chess.js';
import { GamesService, inspectPosition } from './games.service';
import { PrismaService } from '../../prisma/prisma.service';

const WHITE = 'user-white';
const BLACK = 'user-black';

function gameRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'g1',
    status: 'ACTIVE',
    whiteId: WHITE,
    blackId: BLACK,
    result: null,
    resultReason: null,
    fen: new Chess().fen(),
    pgn: '',
    revision: 0,
    createdAt: new Date(), // "fresh" — not stale
    endedAt: null,
    ...over
  } as Record<string, any>;
}

describe('inspectPosition', () => {
  it('reports the winning side on checkmate (fool’s mate)', () => {
    const c = new Chess();
    ['f3', 'e5', 'g4', 'Qh4#'].forEach((m) => c.move(m));
    expect(inspectPosition(c).over).toEqual({ result: 'BLACK_WINS', reason: 'checkmate' });
  });

  it('reports a draw on stalemate', () => {
    const c = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(inspectPosition(c).over).toEqual({ result: 'DRAW', reason: 'stalemate' });
  });

  it('returns null for an ongoing position', () => {
    expect(inspectPosition(new Chess()).over).toBeNull();
  });
});

describe('GamesService', () => {
  let service: GamesService;
  let row: Record<string, any> | null;
  let prisma: {
    game: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    row = gameRow();
    prisma = {
      game: {
        create: jest.fn((a) => Promise.resolve({ id: 'g1', ...a.data })),
        findUnique: jest.fn(() => Promise.resolve(row ? { ...row } : null)),
        findMany: jest.fn().mockResolvedValue([]),
        // Models a conditional UPDATE ... WHERE against the single `row`.
        updateMany: jest.fn((a: { where: Record<string, any>; data: Record<string, any> }) => {
          const w = a.where;
          if (!row) return Promise.resolve({ count: 0 });
          if (w.id && row.id !== w.id) return Promise.resolve({ count: 0 });
          if (w.status && row.status !== w.status) return Promise.resolve({ count: 0 });
          if ('revision' in w && row.revision !== w.revision) return Promise.resolve({ count: 0 });
          if (w.createdAt?.lt && !(row.createdAt < w.createdAt.lt)) return Promise.resolve({ count: 0 });
          if (
            w.OR &&
            !w.OR.some((c: Record<string, unknown>) =>
              Object.entries(c).every(([k, v]) => row![k] === v)
            )
          ) {
            return Promise.resolve({ count: 0 });
          }
          for (const seat of ['whiteId', 'blackId']) {
            if (seat in w && w[seat] === null && row[seat] !== null) return Promise.resolve({ count: 0 });
          }
          const data = { ...a.data };
          if (data.revision && typeof data.revision === 'object' && 'increment' in data.revision) {
            row.revision += data.revision.increment;
            delete data.revision;
          }
          Object.assign(row, data);
          return Promise.resolve({ count: 1 });
        })
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

    it('retires the creator’s earlier open challenge first (one open challenge per user)', async () => {
      await service.create(WHITE, 'white');
      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', OR: [{ whiteId: WHITE }, { blackId: WHITE }] },
        data: { status: 'ABANDONED', endedAt: expect.any(Date) }
      });
    });
  });

  describe('getForUser — access control', () => {
    it('lets a participant read the game', async () => {
      row = gameRow();
      await expect(service.getForUser('g1', WHITE)).resolves.toMatchObject({ id: 'g1' });
    });

    it('lets anyone read a PENDING game with an open seat (public challenge)', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      await expect(service.getForUser('g1', 'stranger')).resolves.toMatchObject({ id: 'g1' });
    });

    it('blocks a non-participant from reading a live game', async () => {
      row = gameRow(); // ACTIVE, both seats filled
      await expect(service.getForUser('g1', 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('join', () => {
    it('claims the open seat atomically and flips the game to ACTIVE', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      await service.join('g1', BLACK);

      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: { id: 'g1', status: 'PENDING', blackId: null },
        data: { blackId: BLACK, status: 'ACTIVE' }
      });
      expect(row).toMatchObject({ blackId: BLACK, status: 'ACTIVE' });
    });

    it('reports a conflict instead of overwriting when the seat was taken concurrently', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      const real = prisma.game.updateMany.getMockImplementation()!;
      // fail only the seat-claim (has where.id); the stale-sweep (no id) is untouched
      prisma.game.updateMany.mockImplementation((a: { where: Record<string, unknown> }) =>
        a.where.id ? Promise.resolve({ count: 0 }) : real(a)
      );
      await expect(service.join('g1', BLACK)).rejects.toThrow(ConflictException);
    });

    it('sweeps stale pending challenges before serving the list', async () => {
      await service.listForUser(WHITE);
      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', createdAt: { lt: expect.any(Date) } },
        data: { status: 'ABANDONED', endedAt: expect.any(Date) }
      });
    });

    it('rejects joining your own game', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      await expect(service.join('g1', WHITE)).rejects.toThrow(BadRequestException);
      // the stale-sweep may run, but no seat-claim (a call carrying where.id)
      const claimed = prisma.game.updateMany.mock.calls.some((c) => c[0]?.where?.id);
      expect(claimed).toBe(false);
    });

    it('rejects joining a game that is already full', async () => {
      row = gameRow({ status: 'ACTIVE' });
      await expect(service.join('g1', 'someone-else')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for an unknown game', async () => {
      row = null;
      await expect(service.join('nope', BLACK)).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyMove', () => {
    it('accepts a legal move and writes it under the current revision', async () => {
      row = gameRow(); // revision 0
      const res = await service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' });

      expect(res.move).toMatchObject({ san: 'e4', color: 'w' });
      const call = prisma.game.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'g1', status: 'ACTIVE', revision: 0 });
      expect(call.data.pgn).toContain('1. e4');
      expect(call.data.revision).toEqual({ increment: 1 });
      expect(row!.revision).toBe(1);
      expect(res.over).toBeNull();
    });

    it('rejects and does not persist when the revision has moved on (concurrent move)', async () => {
      row = gameRow();
      prisma.game.updateMany.mockResolvedValueOnce({ count: 0 }); // someone else moved first
      await expect(service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' })).rejects.toThrow(
        ConflictException
      );
      expect(row!.pgn).toBe(''); // nothing written
    });

    it('is rejected — not applied — when the opponent resigns while the move is in flight', async () => {
      row = gameRow(); // ACTIVE, revision 0, white to move
      const realUpdateMany = prisma.game.updateMany.getMockImplementation()!;
      prisma.game.updateMany.mockImplementationOnce((a: unknown) => {
        // opponent's resignation commits between our read and our write
        row = gameRow({
          status: 'FINISHED',
          result: 'BLACK_WINS',
          resultReason: 'resignation',
          revision: 1
        });
        return realUpdateMany(a);
      });

      await expect(service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' })).rejects.toThrow(
        ConflictException
      );
      expect(row!.pgn).toBe(''); // the move never landed
      expect(row!.result).toBe('BLACK_WINS'); // the resignation stands
    });

    it("rejects a move when it is not that player's turn", async () => {
      row = gameRow();
      await expect(service.applyMove('g1', BLACK, { from: 'e7', to: 'e5' })).rejects.toThrow(
        /not your turn/i
      );
    });

    it('rejects an illegal move', async () => {
      row = gameRow();
      await expect(service.applyMove('g1', WHITE, { from: 'e2', to: 'e5' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects a move from someone who is not in the game', async () => {
      row = gameRow();
      await expect(service.applyMove('g1', 'stranger', { from: 'e2', to: 'e4' })).rejects.toThrow(
        ForbiddenException
      );
    });

    it('rejects moves once the game is finished', async () => {
      row = gameRow({ status: 'FINISHED' });
      await expect(service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('marks the game FINISHED and records the winner on checkmate', async () => {
      const c = new Chess();
      ['f3', 'e5', 'g4'].forEach((m) => c.move(m));
      row = gameRow({ pgn: c.pgn() });

      const res = await service.applyMove('g1', BLACK, { from: 'd8', to: 'h4' });

      expect(res.over).toEqual({ result: 'BLACK_WINS', reason: 'checkmate' });
      expect(res.game).toMatchObject({
        status: 'FINISHED',
        result: 'BLACK_WINS',
        resultReason: 'checkmate'
      });
      expect(row!.endedAt).toBeInstanceOf(Date);
    });
  });

  describe('resign', () => {
    it('ends the game in favour of the opponent', async () => {
      row = gameRow();
      const g = await service.resign('g1', WHITE);
      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: { id: 'g1', status: 'ACTIVE' },
        data: expect.objectContaining({
          status: 'FINISHED',
          result: 'BLACK_WINS',
          resultReason: 'resignation',
          revision: { increment: 1 }
        })
      });
      expect(g).toMatchObject({ status: 'FINISHED', result: 'BLACK_WINS' });
      expect(row!.revision).toBe(1); // invalidates any move in flight on this position
    });

    it('returns the real result when a move finished the game first (no overwrite)', async () => {
      row = gameRow();
      prisma.game.updateMany.mockImplementationOnce(() => {
        row = gameRow({ status: 'FINISHED', result: 'WHITE_WINS', resultReason: 'checkmate' });
        return Promise.resolve({ count: 0 });
      });

      const g = await service.resign('g1', BLACK);
      expect(g).toMatchObject({ result: 'WHITE_WINS', resultReason: 'checkmate' });
    });

    it('rejects a resign from a non-player', async () => {
      row = gameRow();
      await expect(service.resign('g1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('rejects resigning a game that is not in progress', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      await expect(service.resign('g1', WHITE)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('abandons your own pending challenge', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      const g = await service.cancel('g1', WHITE);
      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: { id: 'g1', status: 'PENDING' },
        data: { status: 'ABANDONED', endedAt: expect.any(Date) }
      });
      expect(g).toMatchObject({ status: 'ABANDONED' });
    });

    it('rejects cancelling a game you are not in', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      await expect(service.cancel('g1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('rejects cancelling a game that is not pending', async () => {
      row = gameRow(); // ACTIVE
      await expect(service.cancel('g1', WHITE)).rejects.toThrow(BadRequestException);
    });

    it('reports a conflict when an opponent joined between the read and the write', async () => {
      row = gameRow({ status: 'PENDING', blackId: null });
      const real = prisma.game.updateMany.getMockImplementation()!;
      prisma.game.updateMany.mockImplementation((a: { where: Record<string, unknown> }) =>
        a.where.id ? Promise.resolve({ count: 0 }) : real(a)
      );
      await expect(service.cancel('g1', WHITE)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown game', async () => {
      row = null;
      await expect(service.cancel('nope', WHITE)).rejects.toThrow(NotFoundException);
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
