import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
import { Chess } from 'chess.js';
import { GamesService, clockSnapshot, inspectPosition } from './games.service';
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
    openChallengeOwnerId: null,
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

describe('clockSnapshot', () => {
  const now = 1_000_000;
  it('ticks the side to move down and freezes the other', () => {
    const snap = clockSnapshot(
      { initialSeconds: 600, whiteMs: 300_000, blackMs: 250_000, clockUpdatedAt: new Date(now - 5_000) },
      'w',
      'ACTIVE',
      now
    );
    expect(snap.whiteMs).toBe(295_000);
    expect(snap.blackMs).toBe(250_000);
    expect(snap.running).toBe('w');
  });

  it('does not tick once the game is finished', () => {
    const snap = clockSnapshot(
      { initialSeconds: 600, whiteMs: 300_000, blackMs: 250_000, clockUpdatedAt: new Date(now - 5_000) },
      'w',
      'FINISHED',
      now
    );
    expect(snap).toMatchObject({ whiteMs: 300_000, blackMs: 250_000, running: null });
  });

  it('returns nulls for an untimed game', () => {
    expect(
      clockSnapshot({ initialSeconds: null, whiteMs: null, blackMs: null, clockUpdatedAt: null }, 'w', 'ACTIVE')
    ).toEqual({ whiteMs: null, blackMs: null, running: null });
  });
});

describe('GamesService', () => {
  let service: GamesService;
  let row: Record<string, any> | null;
  let prisma: {
    game: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
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
        findFirst: jest.fn(() => Promise.resolve(row ? { ...row } : null)),
        findMany: jest.fn().mockResolvedValue([]),
        // Models a conditional UPDATE ... WHERE against the single `row`.
        updateMany: jest.fn((a: { where: Record<string, any>; data: Record<string, any> }) => {
          const w = a.where;
          if (!row) return Promise.resolve({ count: 0 });
          if (w.id && row.id !== w.id) return Promise.resolve({ count: 0 });
          if (w.status && row.status !== w.status) return Promise.resolve({ count: 0 });
          if ('revision' in w && row.revision !== w.revision) return Promise.resolve({ count: 0 });
          if ('openChallengeOwnerId' in w && row.openChallengeOwnerId !== w.openChallengeOwnerId)
            return Promise.resolve({ count: 0 });
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
    it('seats the creator as white when they ask for white and claims the challenge slot', async () => {
      await service.create(WHITE, 'white');
      const data = prisma.game.create.mock.calls[0][0].data;
      expect(data.whiteId).toBe(WHITE);
      expect(data.blackId).toBeNull();
      expect(data.status).toBe('PENDING');
      expect(data.openChallengeOwnerId).toBe(WHITE);
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

    it('retires the creator’s pre-existing open challenge first (one open challenge per user)', async () => {
      await service.create(WHITE, 'white');
      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: { openChallengeOwnerId: WHITE, status: 'PENDING', createdAt: { lt: expect.any(Date) } },
        data: { status: 'ABANDONED', openChallengeOwnerId: null, endedAt: expect.any(Date) }
      });
    });

    it('leaves exactly one pending game when the same user creates twice concurrently', async () => {
      // model the DB unique constraint on openChallengeOwnerId
      let slotTaken = false;
      const winner = gameRow({ id: 'g-open', status: 'PENDING', blackId: null, openChallengeOwnerId: WHITE });
      prisma.game.create.mockImplementation((a: { data: Record<string, any> }) => {
        if (a.data.openChallengeOwnerId === WHITE && slotTaken) {
          return Promise.reject(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
        }
        slotTaken = true;
        row = winner;
        return Promise.resolve(winner);
      });
      prisma.game.findFirst.mockResolvedValue(winner);

      const [a, b] = await Promise.all([service.create(WHITE, 'white'), service.create(WHITE, 'black')]);

      expect(prisma.game.create).toHaveBeenCalledTimes(2);
      expect(a).toMatchObject({ id: 'g-open' });
      expect(b).toMatchObject({ id: 'g-open' }); // the loser got handed the winner's game
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
        data: { blackId: BLACK, status: 'ACTIVE', openChallengeOwnerId: null }
      });
      expect(row).toMatchObject({ blackId: BLACK, status: 'ACTIVE', openChallengeOwnerId: null });
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
        data: { status: 'ABANDONED', openChallengeOwnerId: null, endedAt: expect.any(Date) }
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
        data: { status: 'ABANDONED', openChallengeOwnerId: null, endedAt: expect.any(Date) }
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

  describe('clock', () => {
    it('stores a supported time control on create and rejects an unsupported one', async () => {
      await service.create(WHITE, 'white', 1200);
      expect(prisma.game.create.mock.calls[0][0].data.initialSeconds).toBe(1200);
      await expect(service.create(WHITE, 'white', 137)).rejects.toThrow(BadRequestException);
    });

    it('starts both clocks when the second player joins a timed game', async () => {
      row = gameRow({ status: 'PENDING', blackId: null, initialSeconds: 600 });
      await service.join('g1', BLACK);
      expect(row!.status).toBe('ACTIVE');
      expect(row!.whiteMs).toBe(600_000);
      expect(row!.blackMs).toBe(600_000);
      expect(row!.clockUpdatedAt).toBeInstanceOf(Date);
    });

    it('deducts the mover’s elapsed time and restamps the clock on a move', async () => {
      const started = new Date(Date.now() - 8_000); // white has been thinking 8s
      row = gameRow({
        initialSeconds: 600,
        whiteMs: 600_000,
        blackMs: 600_000,
        clockUpdatedAt: started
      });
      await service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' });
      expect(row!.whiteMs).toBeLessThanOrEqual(592_000);
      expect(row!.whiteMs).toBeGreaterThan(590_000);
      expect(row!.blackMs).toBe(600_000); // untouched — black's clock now runs
      expect(row!.clockUpdatedAt.getTime()).toBeGreaterThan(started.getTime());
    });

    it('flags the mover who tries to move after their own clock expired', async () => {
      row = gameRow({
        initialSeconds: 600,
        whiteMs: 3_000,
        blackMs: 600_000,
        clockUpdatedAt: new Date(Date.now() - 5_000)
      });
      const res = await service.applyMove('g1', WHITE, { from: 'e2', to: 'e4' });
      expect(res.move).toBeNull();
      expect(res.over).toEqual({ result: 'BLACK_WINS', reason: 'timeout' });
      expect(row!.status).toBe('FINISHED');
      expect(row!.result).toBe('BLACK_WINS');
      expect(row!.resultReason).toBe('timeout');
    });

    describe('flagTimeout', () => {
      it('finishes the game for the running side once their clock hits zero', async () => {
        row = gameRow({
          initialSeconds: 600,
          whiteMs: 1_000,
          blackMs: 600_000,
          clockUpdatedAt: new Date(Date.now() - 4_000)
        });
        const res = await service.flagTimeout('g1');
        expect(res?.over).toEqual({ result: 'BLACK_WINS', reason: 'timeout' });
        expect(row!.status).toBe('FINISHED');
        expect(row!.whiteMs).toBe(0);
      });

      it('is a no-op while the running side still has time', async () => {
        row = gameRow({
          initialSeconds: 600,
          whiteMs: 300_000,
          blackMs: 600_000,
          clockUpdatedAt: new Date(Date.now() - 4_000)
        });
        expect(await service.flagTimeout('g1')).toBeNull();
        expect(row!.status).toBe('ACTIVE');
      });

      it('is a no-op for an untimed game', async () => {
        row = gameRow();
        expect(await service.flagTimeout('g1')).toBeNull();
      });
    });
  });
});
