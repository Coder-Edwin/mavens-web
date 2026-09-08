import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TournamentsService — Swiss rounds', () => {
  let service: TournamentsService;
  let prisma: any;

  const reg = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    tournamentId: 't1',
    studentId: `stu-${id}`,
    registeredAt: new Date('2026-01-01'),
    withdrawn: false,
    seed: null,
    student: { firstName: id.toUpperCase(), lastName: 'P' },
    ...over
  });

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn() },
      tournamentRegistration: { findUnique: jest.fn(), update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })) },
      tournamentRound: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn((a: any) => Promise.resolve({ id: 'rd-1', number: a.data.number, status: 'PAIRED', pairings: a.data.pairings.create.map((p: any, i: number) => ({ id: `pr-${i}`, ...p, result: p.result ?? null })) })),
        update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
        aggregate: jest.fn(),
        delete: jest.fn().mockResolvedValue({})
      },
      tournamentPairing: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn()
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [TournamentsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(TournamentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('pairNextRound', () => {
    it('pairs round 1 top-half vs bottom-half for four players', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 't1',
        totalRounds: 3,
        registrations: [reg('a', { seed: 1 }), reg('b', { seed: 2 }), reg('c', { seed: 3 }), reg('d', { seed: 4 })],
        rounds: []
      });
      await service.pairNextRound('t1');
      const created = prisma.tournamentRound.create.mock.calls[0][0].data;
      expect(created.number).toBe(1);
      const boards = created.pairings.create.map((p: any) => [p.whiteRegistrationId, p.blackRegistrationId].sort().join('-')).sort();
      expect(boards).toEqual(['a-c', 'b-d']);
    });

    it('refuses to pair while the previous round is unfinished', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 't1',
        totalRounds: null,
        registrations: [reg('a'), reg('b')],
        rounds: [{ number: 1, status: 'PAIRED', pairings: [] }]
      });
      await expect(service.pairNextRound('t1')).rejects.toThrow(BadRequestException);
    });

    it('stops once every planned round is paired', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 't1',
        totalRounds: 1,
        registrations: [reg('a'), reg('b')],
        rounds: [{ number: 1, status: 'COMPLETED', pairings: [{ whiteRegistrationId: 'a', blackRegistrationId: 'b', result: 'WHITE_WIN' }] }]
      });
      await expect(service.pairNextRound('t1')).rejects.toThrow(BadRequestException);
    });

    it('round 2 keeps score groups together and avoids the round-1 rematch', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 't1',
        totalRounds: 3,
        registrations: [reg('a', { seed: 1 }), reg('b', { seed: 2 }), reg('c', { seed: 3 }), reg('d', { seed: 4 })],
        rounds: [
          {
            number: 1,
            status: 'COMPLETED',
            pairings: [
              { whiteRegistrationId: 'a', blackRegistrationId: 'c', result: 'WHITE_WIN' },
              { whiteRegistrationId: 'b', blackRegistrationId: 'd', result: 'WHITE_WIN' }
            ]
          }
        ]
      });
      await service.pairNextRound('t1');
      const created = prisma.tournamentRound.create.mock.calls[0][0].data;
      expect(created.number).toBe(2);
      const boards = created.pairings.create.map((p: any) => [p.whiteRegistrationId, p.blackRegistrationId].sort().join('-')).sort();
      // winners a,b (1pt) meet; losers c,d meet
      expect(boards).toEqual(['a-b', 'c-d']);
    });

    it('gives the odd player a bye worth a point', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 't1',
        totalRounds: null,
        registrations: [reg('a', { seed: 1 }), reg('b', { seed: 2 }), reg('c', { seed: 3 })],
        rounds: []
      });
      await service.pairNextRound('t1');
      const created = prisma.tournamentRound.create.mock.calls[0][0].data;
      const bye = created.pairings.create.find((p: any) => p.blackRegistrationId === null);
      expect(bye).toMatchObject({ result: 'BYE' });
    });
  });

  describe('recordPairingResult', () => {
    it('completes the round once the last result is entered', async () => {
      prisma.tournamentPairing.findUnique.mockResolvedValue({
        id: 'pr-1',
        result: null,
        roundId: 'rd-1',
        round: { tournamentId: 't1' }
      });
      prisma.tournamentPairing.count.mockResolvedValue(0);
      prisma.tournamentRound.findUnique.mockResolvedValue({ id: 'rd-1', pairings: [] });
      await service.recordPairingResult('t1', 'pr-1', { result: 'DRAW' });
      expect(prisma.tournamentRound.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } })
      );
    });

    it('will not overwrite a bye', async () => {
      prisma.tournamentPairing.findUnique.mockResolvedValue({
        id: 'pr-1',
        result: 'BYE',
        roundId: 'rd-1',
        round: { tournamentId: 't1' }
      });
      await expect(service.recordPairingResult('t1', 'pr-1', { result: 'DRAW' })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('deleteRound', () => {
    it('only removes the most recent round', async () => {
      prisma.tournamentRound.findUnique.mockResolvedValue({ id: 'rd-1', tournamentId: 't1', number: 1 });
      prisma.tournamentRound.aggregate.mockResolvedValue({ _max: { number: 2 } });
      await expect(service.deleteRound('t1', 'rd-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('standings', () => {
    it('ranks by score then Buchholz', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 't1',
        registrations: [reg('a'), reg('b'), reg('c'), reg('d')],
        rounds: [
          {
            pairings: [
              { whiteRegistrationId: 'a', blackRegistrationId: 'b', result: 'WHITE_WIN' },
              { whiteRegistrationId: 'c', blackRegistrationId: 'd', result: 'DRAW' }
            ]
          },
          {
            pairings: [
              { whiteRegistrationId: 'a', blackRegistrationId: 'c', result: 'WHITE_WIN' },
              { whiteRegistrationId: 'b', blackRegistrationId: 'd', result: 'BLACK_WIN' }
            ]
          }
        ]
      });
      const rows = await service.standings('t1');
      expect(rows[0]).toMatchObject({ rank: 1, registrationId: 'a', score: 2 });
      expect(rows.map((r) => r.registrationId)).toEqual(['a', 'd', 'c', 'b']);
    });
  });
});
