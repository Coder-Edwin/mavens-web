import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CoachesService } from './coaches.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CoachesService', () => {
  let service: CoachesService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    coachProfile: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn((a) =>
          Promise.resolve({
            id: 'u-1',
            email: a.data.email,
            coachProfile: { id: 'coach-1', ...a.data.coachProfile.create }
          })
        )
      },
      coachProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data }))
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoachesService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(CoachesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ email: 'b@x.com', firstName: 'Brian', lastName: 'Otieno' })
      ).rejects.toThrow(ConflictException);
    });

    it('creates a COACH user with a trimmed, lowercased email and a temp password', async () => {
      const result = await service.create({
        email: '  Brian@Example.COM ',
        firstName: '  Brian ',
        lastName: ' Otieno ',
        employmentType: 'CONSULTANT'
      });
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.email).toBe('brian@example.com');
      expect(data.role).toBe('COACH');
      expect(data.coachProfile.create).toMatchObject({
        firstName: 'Brian',
        lastName: 'Otieno',
        employmentType: 'CONSULTANT'
      });
      expect(result.tempPassword).toEqual(expect.any(String));
    });

    it('defaults employmentType to STAFF', async () => {
      await service.create({ email: 'c@x.com', firstName: 'C', lastName: 'D' });
      expect(prisma.user.create.mock.calls[0][0].data.coachProfile.create.employmentType).toBe('STAFF');
    });
  });

  describe('findOne', () => {
    it('throws when the coach is missing', async () => {
      prisma.coachProfile.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('nulls a cleared optional field and leaves absent fields untouched', async () => {
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      await service.update('coach-1', { phone: '   ', specialty: 'Endgames' });
      const data = prisma.coachProfile.update.mock.calls[0][0].data;
      expect(data.phone).toBeNull();
      expect(data.specialty).toBe('Endgames');
      expect(data.firstName).toBeUndefined();
    });
  });
});
