import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RateCardsService } from './rate-cards.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RateCardsService', () => {
  let service: RateCardsService;
  let prisma: {
    rateCard: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const card = (over: Record<string, unknown>) => ({
    id: 'rc',
    name: 'card',
    deliveryType: 'CENTER',
    level: null,
    clientType: null,
    unit: 'PER_SESSION',
    amount: 1500,
    currency: 'KES',
    active: true,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    ...over
  });

  beforeEach(async () => {
    prisma = {
      rateCard: {
        create: jest.fn((a) => Promise.resolve({ id: 'rc-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateCardsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(RateCardsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('defaults unit, currency and active', async () => {
      await service.create({ name: 'Centre novices', deliveryType: 'CENTER', amount: 1200 });
      expect(prisma.rateCard.create.mock.calls[0][0].data).toMatchObject({
        unit: 'PER_SESSION',
        currency: 'KES',
        active: true
      });
    });
  });

  describe('resolve', () => {
    it('prefers the card matching level + clientType over the generic one', async () => {
      prisma.rateCard.findMany.mockResolvedValue([
        card({ id: 'generic' }),
        card({ id: 'level', level: 'INTERMEDIATE' }),
        card({ id: 'both', level: 'INTERMEDIATE', clientType: 'INDIVIDUAL' })
      ]);
      const best = await service.resolve(
        { deliveryType: 'CENTER', level: 'INTERMEDIATE', clientType: 'INDIVIDUAL' },
        new Date('2026-06-01')
      );
      expect(best?.id).toBe('both');
    });

    it('disqualifies a card whose level does not match', async () => {
      prisma.rateCard.findMany.mockResolvedValue([
        card({ id: 'generic' }),
        card({ id: 'wrong-level', level: 'ADVANCED' })
      ]);
      const best = await service.resolve(
        { deliveryType: 'CENTER', level: 'NOVICE', clientType: 'INDIVIDUAL' },
        new Date('2026-06-01')
      );
      expect(best?.id).toBe('generic');
    });

    it('returns null when nothing matches', async () => {
      prisma.rateCard.findMany.mockResolvedValue([]);
      const best = await service.resolve(
        { deliveryType: 'HOME', level: null, clientType: 'INDIVIDUAL' },
        new Date('2026-06-01')
      );
      expect(best).toBeNull();
    });
  });

  describe('remove', () => {
    it('refuses to delete a card referenced by invoice lines', async () => {
      prisma.rateCard.findUnique.mockResolvedValue({ id: 'rc-1', _count: { invoiceLines: 4 } });
      await expect(service.remove('rc-1')).rejects.toThrow(BadRequestException);
    });
  });
});
