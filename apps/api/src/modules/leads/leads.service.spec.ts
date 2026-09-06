import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: {
    lead: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      lead: {
        create: jest.fn((args) => Promise.resolve({ id: 'lead-1', ...args.data })),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn((args) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LeadsService, { provide: PrismaService, useValue: prisma }]
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('normalises the submission and starts it as a NEW lead', async () => {
      await service.create({
        parentName: '  Grace Wambui ',
        email: '  Grace@Example.COM ',
        phone: ' 254712345678 ',
        childName: '  Faith ',
        childAge: 9,
        message: '  Interested in weekend classes.  '
      });

      const data = prisma.lead.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        parentName: 'Grace Wambui',
        email: 'grace@example.com',
        phone: '254712345678',
        childName: 'Faith',
        childAge: 9,
        message: 'Interested in weekend classes.'
      });
      // status is left to the schema default (NEW), not set explicitly here
      expect(data.status).toBeUndefined();
    });

    it('stores blank optional fields as null', async () => {
      await service.create({ parentName: 'A Parent', email: 'a@b.com', phone: '0712000000' });
      const data = prisma.lead.create.mock.calls[0][0].data;
      expect(data.childName).toBeNull();
      expect(data.childAge).toBeNull();
      expect(data.message).toBeNull();
    });
  });

  describe('findAllForAdmin', () => {
    it('floats NEW leads above already-triaged ones while keeping recency order', async () => {
      prisma.lead.findMany.mockResolvedValue([
        { id: '3', status: 'CONTACTED', createdAt: new Date('2026-09-03') },
        { id: '2', status: 'NEW', createdAt: new Date('2026-09-02') },
        { id: '1', status: 'ARCHIVED', createdAt: new Date('2026-09-01') }
      ]);

      const result = await service.findAllForAdmin();

      expect(result.map((l) => l.id)).toEqual(['2', '3', '1']);
      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('passes a valid ?status filter straight through without re-sorting', async () => {
      prisma.lead.findMany.mockResolvedValue([{ id: '9', status: 'CONTACTED' }]);
      await service.findAllForAdmin('CONTACTED');
      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: { status: 'CONTACTED' },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('ignores an unrecognised status value', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      await service.findAllForAdmin('bogus');
      expect(prisma.lead.findMany.mock.calls[0][0].where).toBeUndefined();
    });
  });

  describe('update', () => {
    it('throws NotFoundException for an unknown lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { status: 'CONTACTED' })).rejects.toThrow(NotFoundException);
    });

    it('applies a status change', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', status: 'NEW' });
      await service.update('lead-1', { status: 'ENROLLED' });
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { status: 'ENROLLED', notes: undefined }
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for an unknown lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });

    it('deletes an existing lead and returns its id', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
      await expect(service.remove('lead-1')).resolves.toEqual({ id: 'lead-1' });
      expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    });
  });
});
