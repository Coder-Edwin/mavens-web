import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LessonPlansService } from './lesson-plans.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('LessonPlansService', () => {
  let service: LessonPlansService;
  let prisma: any;

  const coachUser: AuthenticatedUser = { userId: 'coach-user-1', email: 'c@x.com', role: 'COACH', isCoach: true };
  const otherCoachUser: AuthenticatedUser = { userId: 'coach-user-2', email: 'c2@x.com', role: 'COACH', isCoach: true };
  const adminUser: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };
  const dualRoleUser: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: true };

  const plan = (over: Record<string, unknown> = {}) => ({
    id: 'lp-1',
    coachId: 'coach-1',
    title: 'Rook Endgames',
    objectives: null,
    materialUrl: null,
    difficulty: null,
    createdAt: new Date('2026-01-01'),
    ...over
  });

  beforeEach(async () => {
    prisma = {
      coachProfile: {
        findUnique: jest.fn((a: any) =>
          Promise.resolve(
            a.where.userId === 'coach-user-1' || a.where.userId === 'admin-1'
              ? { id: 'coach-1' }
              : a.where.userId === 'coach-user-2'
                ? { id: 'coach-2' }
                : null
          )
        )
      },
      lessonPlan: {
        create: jest.fn((a: any) => Promise.resolve(plan({ id: 'lp-1', ...a.data }))),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve(plan({ id: a.where.id, ...a.data }))),
        delete: jest.fn().mockResolvedValue({})
      },
      session: { count: jest.fn().mockResolvedValue(0) }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LessonPlansService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(LessonPlansService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a plan under the caller’s own coach profile', async () => {
      const created = await service.create({ title: '  Rook Endgames  ' } as any, coachUser);
      expect(created.title).toBe('Rook Endgames');
      expect(prisma.lessonPlan.create.mock.calls[0][0].data.coachId).toBe('coach-1');
    });

    it('refuses a caller with no coach profile', async () => {
      const noCoach: AuthenticatedUser = { userId: 'ghost', email: 'g@x.com', role: 'ADMIN', isCoach: false };
      await expect(service.create({ title: 'X' } as any, noCoach)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('gives a plain admin the whole club’s library', async () => {
      await service.findAll(adminUser);
      expect(prisma.lessonPlan.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { coach: { select: { firstName: true, lastName: true } } }
      });
    });

    it('scopes a coach (including an admin-who-is-also-a-coach) to their own plans', async () => {
      await service.findAll(dualRoleUser);
      expect(prisma.lessonPlan.findMany).toHaveBeenCalledWith({
        where: { coachId: 'coach-1' },
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('ownership', () => {
    it('blocks a different coach from updating the plan', async () => {
      prisma.lessonPlan.findUnique.mockResolvedValue(plan());
      await expect(service.update('lp-1', { title: 'X' }, otherCoachUser)).rejects.toThrow(ForbiddenException);
    });

    it('lets an admin edit any coach’s plan', async () => {
      prisma.lessonPlan.findUnique.mockResolvedValue(plan());
      await expect(service.update('lp-1', { title: 'Updated' }, adminUser)).resolves.toMatchObject({
        title: 'Updated'
      });
    });

    it('404s on an unknown plan', async () => {
      prisma.lessonPlan.findUnique.mockResolvedValue(null);
      await expect(service.update('ghost', { title: 'X' }, coachUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('refuses to delete a plan a session is using', async () => {
      prisma.lessonPlan.findUnique.mockResolvedValue(plan());
      prisma.session.count.mockResolvedValue(2);
      await expect(service.remove('lp-1', coachUser)).rejects.toThrow(BadRequestException);
    });

    it('deletes an unused plan', async () => {
      prisma.lessonPlan.findUnique.mockResolvedValue(plan());
      await expect(service.remove('lp-1', coachUser)).resolves.toEqual({ id: 'lp-1' });
    });
  });
});
