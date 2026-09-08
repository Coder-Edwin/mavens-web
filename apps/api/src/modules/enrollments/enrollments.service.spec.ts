import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let prisma: {
    studentProfile: { findUnique: jest.Mock };
    parentProfile: { findUnique: jest.Mock };
    schoolGroup: { findUnique: jest.Mock };
    coachProfile: { findUnique: jest.Mock };
    enrollment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      studentProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'stu-1' }) },
      parentProfile: { findUnique: jest.fn() },
      schoolGroup: { findUnique: jest.fn().mockResolvedValue({ id: 'sg-1', institutionName: 'Riverside' }) },
      coachProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      enrollment: {
        create: jest.fn((a) => Promise.resolve({ id: 'enr-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnrollmentsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(EnrollmentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects an unknown student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ studentId: 'ghost', deliveryType: 'HOME' })
      ).rejects.toThrow(NotFoundException);
    });

    it('starts a HOME enrollment awaiting placement and logs a CREATED event', async () => {
      await service.create({ studentId: 'stu-1', deliveryType: 'HOME' }, 'admin-1');
      const data = prisma.enrollment.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        studentId: 'stu-1',
        deliveryType: 'HOME',
        schoolGroupId: null,
        clientType: 'INDIVIDUAL',
        status: 'PENDING_PLACEMENT'
      });
      expect(data.events.create).toEqual([
        { type: 'CREATED', byUserId: 'admin-1', note: null }
      ]);
    });

    it('requires a schoolGroupId for a SCHOOL_GROUP enrollment', async () => {
      await expect(
        service.create({ studentId: 'stu-1', deliveryType: 'SCHOOL_GROUP' })
      ).rejects.toThrow(BadRequestException);
    });

    it('marks a SCHOOL_GROUP enrollment as an INSTITUTION client', async () => {
      await service.create({
        studentId: 'stu-1',
        deliveryType: 'SCHOOL_GROUP',
        schoolGroupId: 'sg-1'
      });
      const data = prisma.enrollment.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ schoolGroupId: 'sg-1', clientType: 'INSTITUTION' });
    });

    it('rejects a SCHOOL_GROUP enrollment against a missing group', async () => {
      prisma.schoolGroup.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ studentId: 'stu-1', deliveryType: 'SCHOOL_GROUP', schoolGroupId: 'nope' })
      ).rejects.toThrow(NotFoundException);
    });

    it('places the enrollment immediately when a level is supplied', async () => {
      await service.create({ studentId: 'stu-1', deliveryType: 'CENTER', level: 'INTERMEDIATE' }, 'admin-1');
      const data = prisma.enrollment.create.mock.calls[0][0].data;
      expect(data.status).toBe('ACTIVE');
      expect(data.events.create).toEqual([
        { type: 'CREATED', byUserId: 'admin-1', note: null },
        { type: 'PLACED', toValue: 'INTERMEDIATE', byUserId: 'admin-1' }
      ]);
    });

    it('honours waitlisted even when a level is supplied', async () => {
      await service.create(
        { studentId: 'stu-1', deliveryType: 'HOME', level: 'NOVICE', waitlisted: true, note: '  full for now  ' },
        'admin-1'
      );
      const data = prisma.enrollment.create.mock.calls[0][0].data;
      expect(data.status).toBe('WAITLISTED');
      expect(data.waitlistNote).toBe('full for now');
      expect(data.events.create).toEqual([
        { type: 'CREATED', byUserId: 'admin-1', note: 'full for now' },
        { type: 'WAITLISTED', byUserId: 'admin-1' }
      ]);
    });

    it('rejects an unknown assigned coach', async () => {
      prisma.coachProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ studentId: 'stu-1', deliveryType: 'HOME', assignedCoachId: 'ghost' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('applies recognised filters and ignores junk', async () => {
      await service.findAll({ status: 'ACTIVE', deliveryType: 'bogus', studentId: 'stu-1' });
      const arg = prisma.enrollment.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ status: 'ACTIVE', studentId: 'stu-1' });
    });
  });

  describe('findOne', () => {
    it('throws when the enrollment is missing', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findForUser', () => {
    const user = (over: Record<string, unknown>) => ({
      userId: 'u1',
      email: 'u@x.com',
      role: 'STUDENT',
      isCoach: false,
      ...over
    });

    it('returns a student’s own enrollments', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      await service.findForUser(user({ role: 'STUDENT' }) as never);
      expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({ studentId: 'stu-1' });
    });

    it('returns every linked child’s enrollments for a parent', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({
        studentLinks: [{ studentId: 'stu-1' }, { studentId: 'stu-2' }]
      });
      await service.findForUser(user({ role: 'PARENT' }) as never);
      expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({
        studentId: { in: ['stu-1', 'stu-2'] }
      });
    });

    it('returns an empty list when the student has no profile', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(service.findForUser(user({ role: 'STUDENT' }) as never)).resolves.toEqual([]);
      expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    it('returns the enrollments assigned to a coach', async () => {
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      await service.findForUser(user({ role: 'COACH' }) as never);
      expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({
        assignedCoachId: 'coach-1'
      });
    });

    it('treats an admin-who-coaches as a coach here (Amwai)', async () => {
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      await service.findForUser(user({ role: 'ADMIN', isCoach: true }) as never);
      expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({
        assignedCoachId: 'coach-1'
      });
    });

    it('returns an empty list for a pure admin', async () => {
      await expect(service.findForUser(user({ role: 'ADMIN' }) as never)).resolves.toEqual([]);
    });
  });

  describe('place', () => {
    it('activates a pending enrollment and logs a PLACED event', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        status: 'PENDING_PLACEMENT',
        level: null
      });
      await service.place('enr-1', { level: 'NOVICE', assignedCoachId: 'coach-1' }, 'admin-1');
      const arg = prisma.enrollment.update.mock.calls[0][0];
      expect(arg.data.status).toBe('ACTIVE');
      expect(arg.data.level).toBe('NOVICE');
      expect(arg.data.assignedCoach).toEqual({ connect: { id: 'coach-1' } });
      expect(arg.data.events.create).toMatchObject({
        type: 'PLACED',
        fromValue: null,
        toValue: 'NOVICE',
        byUserId: 'admin-1'
      });
    });

    it('refuses to place an already-active enrollment', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'ACTIVE', level: 'NOVICE' });
      await expect(service.place('enr-1', { level: 'NOVICE' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('pause / resume', () => {
    it('pauses an active enrollment with a default pausedFrom', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'ACTIVE' });
      await service.pause('enr-1', {}, 'admin-1');
      const arg = prisma.enrollment.update.mock.calls[0][0];
      expect(arg.data.status).toBe('PAUSED');
      expect(arg.data.pausedFrom).toBeInstanceOf(Date);
      expect(arg.data.events.create.type).toBe('PAUSED');
    });

    it('refuses to pause a non-active enrollment', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'PENDING_PLACEMENT' });
      await expect(service.pause('enr-1', {})).rejects.toThrow(BadRequestException);
    });

    it('resumes a paused enrollment and clears the pause window', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'PAUSED' });
      await service.resume('enr-1', {}, 'admin-1');
      const arg = prisma.enrollment.update.mock.calls[0][0];
      expect(arg.data).toMatchObject({ status: 'ACTIVE', pausedFrom: null, pausedTo: null });
    });
  });

  describe('withdraw', () => {
    it('withdraws an active enrollment and stamps an end date', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'ACTIVE' });
      await service.withdraw('enr-1', {}, 'admin-1');
      const arg = prisma.enrollment.update.mock.calls[0][0];
      expect(arg.data.status).toBe('WITHDRAWN');
      expect(arg.data.endDate).toBeInstanceOf(Date);
    });

    it('refuses to withdraw an already-withdrawn enrollment', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'WITHDRAWN' });
      await expect(service.withdraw('enr-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('logs a LEVEL_CHANGE when the level moves', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        status: 'ACTIVE',
        level: 'NOVICE',
        deliveryType: 'HOME',
        schoolGroupId: null,
        assignedCoachId: null
      });
      await service.update('enr-1', { level: 'INTERMEDIATE' }, 'admin-1');
      const arg = prisma.enrollment.update.mock.calls[0][0];
      expect(arg.data.level).toBe('INTERMEDIATE');
      expect(arg.data.events.create).toEqual([
        {
          type: 'LEVEL_CHANGE',
          fromValue: 'NOVICE',
          toValue: 'INTERMEDIATE',
          byUserId: 'admin-1',
          note: null
        }
      ]);
    });

    it('switching to SCHOOL_GROUP delivery connects the group and flips clientType', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        status: 'ACTIVE',
        level: 'NOVICE',
        deliveryType: 'HOME',
        schoolGroupId: null,
        assignedCoachId: null
      });
      await service.update('enr-1', { deliveryType: 'SCHOOL_GROUP', schoolGroupId: 'sg-1' }, 'admin-1');
      const arg = prisma.enrollment.update.mock.calls[0][0];
      expect(arg.data.deliveryType).toBe('SCHOOL_GROUP');
      expect(arg.data.schoolGroup).toEqual({ connect: { id: 'sg-1' } });
      expect(arg.data.clientType).toBe('INSTITUTION');
      expect(arg.data.events.create[0].type).toBe('DELIVERY_CHANGE');
    });

    it('is a no-op write when nothing changed', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        status: 'ACTIVE',
        level: 'NOVICE',
        deliveryType: 'HOME',
        schoolGroupId: null,
        assignedCoachId: null
      });
      await service.update('enr-1', { level: 'NOVICE' }, 'admin-1');
      expect(prisma.enrollment.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an enrollment still awaiting placement', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'PENDING_PLACEMENT' });
      await expect(service.remove('enr-1')).resolves.toEqual({ id: 'enr-1' });
      expect(prisma.enrollment.delete).toHaveBeenCalledWith({ where: { id: 'enr-1' } });
    });

    it('refuses to delete an active enrollment', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', status: 'ACTIVE' });
      await expect(service.remove('enr-1')).rejects.toThrow(BadRequestException);
    });
  });
});
