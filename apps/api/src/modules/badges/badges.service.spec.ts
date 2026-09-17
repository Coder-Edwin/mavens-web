import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('BadgesService', () => {
  let service: BadgesService;
  let prisma: any;

  const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };
  const coach: AuthenticatedUser = { userId: 'coach-user-1', email: 'c@x.com', role: 'COACH', isCoach: true };
  const otherCoach: AuthenticatedUser = { userId: 'coach-user-2', email: 'c2@x.com', role: 'COACH', isCoach: true };
  const student: AuthenticatedUser = { userId: 'student-user-1', email: 's@x.com', role: 'STUDENT', isCoach: false };
  const parentUser: AuthenticatedUser = { userId: 'parent-user-1', email: 'p@x.com', role: 'PARENT', isCoach: false };

  const badge = (over: Record<string, unknown> = {}) => ({
    id: 'badge-1',
    name: 'First Tournament Win',
    icon: '🏆',
    criteria: 'Won a rated tournament game',
    ...over
  });

  beforeEach(async () => {
    prisma = {
      badge: {
        create: jest.fn((a: any) => Promise.resolve(badge({ id: 'badge-1', ...a.data }))),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve(badge({ id: a.where.id, ...a.data }))),
        delete: jest.fn().mockResolvedValue({})
      },
      studentProfile: { findUnique: jest.fn() },
      coachProfile: { findUnique: jest.fn() },
      parentProfile: { findUnique: jest.fn() },
      coachStudent: { findUnique: jest.fn() },
      parentStudent: { findUnique: jest.fn() },
      studentBadge: {
        create: jest.fn((a: any) => Promise.resolve({ ...a.data, badge: badge() })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0)
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [BadgesService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(BadgesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('catalog', () => {
    it('creates a badge', async () => {
      const created = await service.createBadge({ name: '  First Win  ', icon: '🏆' } as any);
      expect(created.name).toBe('First Win');
    });

    it('404s updating an unknown badge', async () => {
      prisma.badge.findUnique.mockResolvedValue(null);
      await expect(service.updateBadge('ghost', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('refuses to delete a badge that has already been awarded', async () => {
      prisma.badge.findUnique.mockResolvedValue(badge());
      prisma.studentBadge.count.mockResolvedValue(3);
      await expect(service.removeBadge('badge-1')).rejects.toThrow(BadRequestException);
    });

    it('deletes an unawarded badge', async () => {
      prisma.badge.findUnique.mockResolvedValue(badge());
      await expect(service.removeBadge('badge-1')).resolves.toEqual({ id: 'badge-1' });
    });
  });

  describe('award', () => {
    it('404s on an unknown student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(service.award({ studentId: 'ghost', badgeId: 'badge-1' }, admin)).rejects.toThrow(
        NotFoundException
      );
    });

    it('404s on an unknown badge', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.badge.findUnique.mockResolvedValue(null);
      await expect(service.award({ studentId: 'stu-1', badgeId: 'ghost' }, admin)).rejects.toThrow(
        NotFoundException
      );
    });

    it('blocks a coach who is not assigned to the student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.badge.findUnique.mockResolvedValue(badge());
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-2' });
      prisma.coachStudent.findUnique.mockResolvedValue(null);
      await expect(service.award({ studentId: 'stu-1', badgeId: 'badge-1' }, otherCoach)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('lets the assigned coach award a badge', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.badge.findUnique.mockResolvedValue(badge());
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      prisma.coachStudent.findUnique.mockResolvedValue({ coachId: 'coach-1', studentId: 'stu-1' });
      const result = await service.award({ studentId: 'stu-1', badgeId: 'badge-1' }, coach);
      expect(result.badge.name).toBe('First Tournament Win');
    });

    it('blocks a student or parent from awarding', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.badge.findUnique.mockResolvedValue(badge());
      await expect(service.award({ studentId: 'stu-1', badgeId: 'badge-1' }, student)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('surfaces a friendly conflict when the student already has this badge', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.badge.findUnique.mockResolvedValue(badge());
      prisma.studentBadge.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
      await expect(service.award({ studentId: 'stu-1', badgeId: 'badge-1' }, admin)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('revoke', () => {
    it('404s when the student does not have this badge', async () => {
      prisma.studentBadge.findUnique.mockResolvedValue(null);
      await expect(service.revoke('stu-1', 'badge-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('removes an awarded badge', async () => {
      prisma.studentBadge.findUnique.mockResolvedValue({ studentId: 'stu-1', badgeId: 'badge-1' });
      await expect(service.revoke('stu-1', 'badge-1', admin)).resolves.toEqual({
        studentId: 'stu-1',
        badgeId: 'badge-1'
      });
    });
  });

  describe('listForStudent / myBadges', () => {
    it('blocks an unlinked parent', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-2' });
      prisma.parentStudent.findUnique.mockResolvedValue(null);
      await expect(service.listForStudent('stu-1', parentUser)).rejects.toThrow(ForbiddenException);
    });

    it('lets a linked parent view them', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      prisma.parentStudent.findUnique.mockResolvedValue({ parentId: 'parent-1', studentId: 'stu-1' });
      await expect(service.listForStudent('stu-1', parentUser)).resolves.toEqual([]);
    });

    it('blocks a student viewing someone else’s badges', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'some-other-student' });
      await expect(service.listForStudent('stu-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('myBadges resolves the caller’s own student id with no id argument', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      await service.myBadges(student);
      expect(prisma.studentBadge.findMany).toHaveBeenCalledWith({
        where: { studentId: 'stu-1' },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' }
      });
    });

    it('myBadges returns an empty list when the caller has no student profile', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(service.myBadges(student)).resolves.toEqual([]);
    });
  });
});
