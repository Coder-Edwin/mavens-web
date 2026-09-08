import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const user = (over: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  userId: 'u1',
  email: 'u@x.com',
  role: 'COACH',
  isCoach: true,
  ...over
});

describe('SessionsService — scheduling', () => {
  let service: SessionsService;
  let txSessionUpdate: jest.Mock;
  let txAttendanceDeleteMany: jest.Mock;
  let prisma: any;

  beforeEach(async () => {
    txSessionUpdate = jest.fn().mockResolvedValue({});
    txAttendanceDeleteMany = jest.fn().mockResolvedValue({});
    prisma = {
      coachProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      studentProfile: { findMany: jest.fn().mockResolvedValue([{ id: 'stu-1' }, { id: 'stu-2' }]) },
      session: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data }))
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          sessionAttendance: { deleteMany: txAttendanceDeleteMany },
          session: {
            update: txSessionUpdate,
            findUnique: jest.fn().mockResolvedValue({ id: 's-1', status: 'COMPLETED' })
          }
        })
      )
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(SessionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll filters', () => {
    it('applies an inclusive from/to day range for an admin', async () => {
      await service.findAll(user({ role: 'ADMIN', isCoach: false }), {
        from: '2026-06-01',
        to: '2026-06-07'
      });
      const where = prisma.session.findMany.mock.calls[0][0].where;
      expect(where.date.gte).toEqual(new Date('2026-06-01'));
      // `to` is bumped to the next midnight so the whole day is covered
      expect(where.date.lt).toEqual(new Date('2026-06-08'));
    });
  });

  describe('complete', () => {
    it('rejects attendance with an unknown student id', async () => {
      prisma.session.findUnique.mockResolvedValue({ id: 's-1', coachId: 'coach-1', status: 'SCHEDULED' });
      prisma.studentProfile.findMany.mockResolvedValue([{ id: 'stu-1' }]);
      await expect(
        service.complete('s-1', { presentStudentIds: ['stu-1', 'ghost'] }, user({}))
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a cancelled session', async () => {
      prisma.session.findUnique.mockResolvedValue({ id: 's-1', coachId: 'coach-1', status: 'CANCELLED' });
      await expect(
        service.complete('s-1', { presentStudentIds: ['stu-1'] }, user({}))
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a session that belongs to another coach', async () => {
      prisma.session.findUnique.mockResolvedValue({ id: 's-1', coachId: 'coach-other', status: 'SCHEDULED' });
      await expect(
        service.complete('s-1', { presentStudentIds: ['stu-1'] }, user({}))
      ).rejects.toThrow(ForbiddenException);
    });

    it('replaces attendance and marks the session COMPLETED', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 's-1',
        coachId: 'coach-1',
        status: 'SCHEDULED',
        topic: 'Rook endgames'
      });
      await service.complete('s-1', { presentStudentIds: ['stu-1', 'stu-2'] }, user({}));
      expect(txAttendanceDeleteMany).toHaveBeenCalledWith({ where: { sessionId: 's-1' } });
      const data = txSessionUpdate.mock.calls[0][0].data;
      expect(data.status).toBe('COMPLETED');
      expect(data.topic).toBe('Rook endgames'); // kept when not overridden
      expect(data.attendance.create).toHaveLength(2);
    });
  });

  describe('cancel', () => {
    it('refuses a completed session', async () => {
      prisma.session.findUnique.mockResolvedValue({ id: 's-1', coachId: 'coach-1', status: 'COMPLETED' });
      await expect(service.cancel('s-1', {}, user({}))).rejects.toThrow(BadRequestException);
    });

    it('marks a scheduled session CANCELLED', async () => {
      prisma.session.findUnique.mockResolvedValue({ id: 's-1', coachId: 'coach-1', status: 'SCHEDULED' });
      await service.cancel('s-1', { notes: 'coach sick' }, user({}));
      expect(prisma.session.update.mock.calls[0][0].data).toMatchObject({
        status: 'CANCELLED',
        notes: 'coach sick'
      });
    });
  });
});
