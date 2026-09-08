import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TermsService } from './terms.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TermsService', () => {
  let service: TermsService;
  let prisma: {
    term: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      term: {
        create: jest.fn((a) => Promise.resolve({ id: 't-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [TermsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(TermsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects a term that ends before it starts', async () => {
      await expect(
        service.create({ name: 'T1', startDate: '2026-05-01', endDate: '2026-04-01' })
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a PLANNED term with trimmed fields', async () => {
      await service.create({
        name: '  Term 2 2026  ',
        startDate: '2026-05-01',
        endDate: '2026-07-31',
        notes: '  half-term break week 6  '
      });
      const data = prisma.term.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ name: 'Term 2 2026', status: 'PLANNED', notes: 'half-term break week 6' });
      expect(data.startDate).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('validates the range against the stored dates when only one bound changes', async () => {
      prisma.term.findUnique.mockResolvedValue({
        id: 't-1',
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-07-31'),
        _count: { schedules: 0 }
      });
      await expect(service.update('t-1', { endDate: '2026-04-01' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('refuses to delete a term that has schedules', async () => {
      prisma.term.findUnique.mockResolvedValue({ id: 't-1', _count: { schedules: 2 } });
      await expect(service.remove('t-1')).rejects.toThrow(BadRequestException);
      expect(prisma.term.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty term', async () => {
      prisma.term.findUnique.mockResolvedValue({ id: 't-1', _count: { schedules: 0 } });
      await expect(service.remove('t-1')).resolves.toEqual({ id: 't-1' });
    });

    it('throws NotFoundException for an unknown term', async () => {
      prisma.term.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
