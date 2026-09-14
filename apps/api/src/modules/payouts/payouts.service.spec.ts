import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      session: { findMany: jest.fn().mockResolvedValue([]) },
      coachProfile: { findMany: jest.fn().mockResolvedValue([]) },
      payoutRun: {
        create: jest.fn((a: any) => Promise.resolve({ id: 'pr-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayoutsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(PayoutsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generate', () => {
    it('rejects a period with no completed sessions', async () => {
      prisma.session.findMany.mockResolvedValue([]);
      await expect(
        service.generate({ periodStart: '2026-06-01', periodEnd: '2026-06-30' })
      ).rejects.toThrow(BadRequestException);
    });

    it('computes amount = flat rate x session count and flags a missing rate', async () => {
      prisma.session.findMany.mockResolvedValue([
        ...Array(8).fill({ coachId: 'coach-1', classSchedule: null }),
        ...Array(3).fill({ coachId: 'coach-2', classSchedule: null })
      ]);
      prisma.coachProfile.findMany.mockResolvedValue([
        { id: 'coach-1', sessionRate: 900 },
        { id: 'coach-2', sessionRate: null }
      ]);

      await service.generate({ periodStart: '2026-06-01', periodEnd: '2026-06-30' });
      const items = prisma.payoutRun.create.mock.calls[0][0].data.items.create;

      const c1 = items.find((i: any) => i.coachId === 'coach-1');
      expect(c1).toMatchObject({ sessionCount: 8, ratePerSession: 900, amount: 7200, notes: null });
      const c2 = items.find((i: any) => i.coachId === 'coach-2');
      expect(c2).toMatchObject({ sessionCount: 3, ratePerSession: 0, amount: 0 });
      expect(c2.notes).toMatch(/no session rate/i);
    });

    it('uses a schedule payoutRate override in place of the coach flat rate', async () => {
      prisma.session.findMany.mockResolvedValue([
        { coachId: 'coach-1', classSchedule: { payoutRate: 2000 } }, // HOME visit override
        { coachId: 'coach-1', classSchedule: null } // falls back to the flat rate
      ]);
      prisma.coachProfile.findMany.mockResolvedValue([{ id: 'coach-1', sessionRate: 1500 }]);

      await service.generate({ periodStart: '2026-06-01', periodEnd: '2026-06-30' });
      const items = prisma.payoutRun.create.mock.calls[0][0].data.items.create;

      const c1 = items.find((i: any) => i.coachId === 'coach-1');
      // (2000 + 1500) / 2 sessions = 1750 average, 3500 total
      expect(c1).toMatchObject({ sessionCount: 2, ratePerSession: 1750, amount: 3500, notes: null });
    });
  });

  describe('lifecycle', () => {
    it('approves only a draft', async () => {
      prisma.payoutRun.findUnique.mockResolvedValue({ id: 'pr-1', status: 'APPROVED' });
      await expect(service.approve('pr-1')).rejects.toThrow(BadRequestException);
    });

    it('marks paid only after approval', async () => {
      prisma.payoutRun.findUnique.mockResolvedValue({ id: 'pr-1', status: 'DRAFT' });
      await expect(service.markPaid('pr-1')).rejects.toThrow(BadRequestException);
    });

    it('deletes only a draft', async () => {
      prisma.payoutRun.findUnique.mockResolvedValue({ id: 'pr-1', status: 'APPROVED' });
      await expect(service.remove('pr-1')).rejects.toThrow(BadRequestException);
    });

    it('approves a draft run', async () => {
      prisma.payoutRun.findUnique.mockResolvedValue({ id: 'pr-1', status: 'DRAFT' });
      await service.approve('pr-1');
      expect(prisma.payoutRun.update.mock.calls[0][0].data).toMatchObject({ status: 'APPROVED' });
    });
  });
});
