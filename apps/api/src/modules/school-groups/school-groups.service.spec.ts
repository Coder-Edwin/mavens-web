import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SchoolGroupsService } from './school-groups.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SchoolGroupsService', () => {
  let service: SchoolGroupsService;
  let prisma: {
    schoolGroup: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      schoolGroup: {
        create: jest.fn((a) => Promise.resolve({ id: 'sg-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchoolGroupsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(SchoolGroupsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('trims text, lowercases the coordinator email and defaults status to PROSPECT', async () => {
      await service.create({
        institutionName: '  Riverside Academy  ',
        address: '  12 Ngong Rd  ',
        coordinatorName: '  Jane Doe  ',
        coordinatorPhone: '  +254700000000  ',
        coordinatorEmail: '  Jane@Riverside.AC.KE  ',
        notes: '  Two classes on Tuesdays.  '
      });
      const data = prisma.schoolGroup.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        institutionName: 'Riverside Academy',
        address: '12 Ngong Rd',
        coordinatorName: 'Jane Doe',
        coordinatorPhone: '+254700000000',
        coordinatorEmail: 'jane@riverside.ac.ke',
        status: 'PROSPECT',
        notes: 'Two classes on Tuesdays.'
      });
    });

    it('stores null for omitted optional fields and keeps an explicit status', async () => {
      await service.create({ institutionName: 'Solo School', status: 'ACTIVE' });
      const data = prisma.schoolGroup.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        institutionName: 'Solo School',
        address: null,
        coordinatorName: null,
        coordinatorPhone: null,
        coordinatorEmail: null,
        agreedGroupSize: null,
        status: 'ACTIVE',
        notes: null
      });
    });
  });

  describe('findAll', () => {
    it('filters by a valid status and orders by status then name with an enrollment count', async () => {
      await service.findAll('ACTIVE');
      const arg = prisma.schoolGroup.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ status: 'ACTIVE' });
      expect(arg.orderBy).toEqual([{ status: 'asc' }, { institutionName: 'asc' }]);
      expect(arg.include).toEqual({ _count: { select: { enrollments: true } } });
    });

    it('ignores an unrecognised status filter', async () => {
      await service.findAll('bogus');
      expect(prisma.schoolGroup.findMany.mock.calls[0][0].where).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the group is missing', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });

    it('returns the group when it exists', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue({ id: 'sg-1', _count: { enrollments: 0 } });
      await expect(service.findOne('sg-1')).resolves.toMatchObject({ id: 'sg-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the group is missing', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { institutionName: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('sends undefined for absent fields and nulls a cleared optional field', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue({ id: 'sg-1', _count: { enrollments: 0 } });
      await service.update('sg-1', { institutionName: '  Renamed  ', address: '   ' });
      const data = prisma.schoolGroup.update.mock.calls[0][0].data;
      expect(data.institutionName).toBe('Renamed');
      expect(data.address).toBeNull();
      expect(data.coordinatorName).toBeUndefined();
      expect(data.status).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the group is missing', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });

    it('refuses to delete a group that still has enrollments', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue({ id: 'sg-1', _count: { enrollments: 3 } });
      await expect(service.remove('sg-1')).rejects.toThrow(BadRequestException);
      expect(prisma.schoolGroup.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty group and returns its id', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue({ id: 'sg-1', _count: { enrollments: 0 } });
      await expect(service.remove('sg-1')).resolves.toEqual({ id: 'sg-1' });
      expect(prisma.schoolGroup.delete).toHaveBeenCalledWith({ where: { id: 'sg-1' } });
    });
  });
});
