import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnnouncementsService, audiencesFor } from './announcements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const user = (over: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  userId: 'u1',
  email: 'u@x.com',
  role: 'PARENT',
  isCoach: false,
  ...over
});

describe('audiencesFor', () => {
  it('always includes ALL', () => {
    expect(audiencesFor(user({ role: 'ADMIN' }))).toEqual(['ALL']);
  });

  it('maps each role to its own group', () => {
    expect(audiencesFor(user({ role: 'PARENT' }))).toEqual(['ALL', 'PARENTS']);
    expect(audiencesFor(user({ role: 'STUDENT' }))).toEqual(['ALL', 'STUDENTS']);
    expect(audiencesFor(user({ role: 'COACH' }))).toEqual(['ALL', 'COACHES']);
  });

  it('adds COACHES for an admin who also coaches (Amwai)', () => {
    expect(audiencesFor(user({ role: 'ADMIN', isCoach: true }))).toEqual(['ALL', 'COACHES']);
  });
});

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: {
    announcement: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      announcement: {
        create: jest.fn((a) => Promise.resolve({ id: 'a-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnnouncementsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(AnnouncementsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('trims content, defaults the audience to ALL and records the author', async () => {
      await service.create({ title: '  Closure  ', body: '  No classes Friday.  ' }, user({ userId: 'admin-1', role: 'ADMIN' }));
      const data = prisma.announcement.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ title: 'Closure', body: 'No classes Friday.', audience: 'ALL', authorId: 'admin-1' });
    });

    it('keeps an explicit audience', async () => {
      await service.create({ title: 't', body: 'b', audience: 'COACHES' }, user({ role: 'ADMIN' }));
      expect(prisma.announcement.create.mock.calls[0][0].data.audience).toBe('COACHES');
    });
  });

  describe('feedFor', () => {
    it('queries only the audiences relevant to the caller, newest first, capped', async () => {
      await service.feedFor(user({ role: 'STUDENT' }));
      const arg = prisma.announcement.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ audience: { in: ['ALL', 'STUDENTS'] } });
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
      expect(arg.take).toBe(20);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the announcement is missing', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { title: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('applies trimmed changes', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a-1' });
      await service.update('a-1', { title: '  New title  ', audience: 'PARENTS' });
      expect(prisma.announcement.update).toHaveBeenCalledWith({
        where: { id: 'a-1' },
        data: { title: 'New title', body: undefined, audience: 'PARENTS' }
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the announcement is missing', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });

    it('deletes an existing announcement and returns its id', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a-1' });
      await expect(service.remove('a-1')).resolves.toEqual({ id: 'a-1' });
      expect(prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: 'a-1' } });
    });
  });
});
