import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlacementsService, addMonths, REVIEW_INTERVAL_MONTHS } from './placements.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('addMonths', () => {
  it('advances by whole months', () => {
    expect(addMonths(new Date('2026-01-15T00:00:00Z'), 6).toISOString().slice(0, 7)).toBe('2026-07');
  });
});

describe('PlacementsService', () => {
  let service: PlacementsService;
  let txEnrollmentUpdate: jest.Mock;
  let txStudentUpdate: jest.Mock;
  let txEnrollmentFindUnique: jest.Mock;
  let prisma: any;

  beforeEach(async () => {
    txEnrollmentUpdate = jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data }));
    txStudentUpdate = jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data }));
    txEnrollmentFindUnique = jest.fn();

    prisma = {
      studentProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'stu-1' }), update: jest.fn() },
      coachProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      enrollment: { findUnique: jest.fn() },
      placementAssessment: {
        create: jest.fn((a) => Promise.resolve({ id: 'pa-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      },
      $transaction: jest.fn(async (cb: any) => {
        const tx = {
          placementAssessment: {
            update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data }))
          },
          studentProfile: { update: txStudentUpdate },
          enrollment: { findUnique: txEnrollmentFindUnique, update: txEnrollmentUpdate }
        };
        return cb(tx);
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlacementsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(PlacementsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('schedule', () => {
    it('rejects an unknown student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(service.schedule({ studentId: 'ghost' })).rejects.toThrow(NotFoundException);
    });

    it('rejects an enrollment that belongs to another student', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-9', studentId: 'someone-else' });
      await expect(
        service.schedule({ studentId: 'stu-1', enrollmentId: 'enr-9' })
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a SCHEDULED assessment', async () => {
      await service.schedule({ studentId: 'stu-1', scheduledFor: '2026-10-01T09:00:00Z', notes: '  bring a clock  ' });
      const data = prisma.placementAssessment.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ studentId: 'stu-1', enrollmentId: null, notes: 'bring a clock' });
      expect(data.scheduledFor).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('refuses to reschedule a completed assessment', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({ id: 'pa-1', status: 'COMPLETED' });
      await expect(service.update('pa-1', { scheduledFor: '2026-10-02T09:00:00Z' })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('complete', () => {
    it('refuses when the assessment is not open', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({ id: 'pa-1', status: 'CANCELLED' });
      await expect(service.complete('pa-1', { resultLevel: 'NOVICE' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('stamps the student level and defaults nextReviewDue six months out', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({
        id: 'pa-1',
        status: 'SCHEDULED',
        studentId: 'stu-1',
        enrollmentId: null
      });
      const result = await service.complete('pa-1', { resultLevel: 'INTERMEDIATE' }, 'admin-1');
      expect(txStudentUpdate).toHaveBeenCalledWith({
        where: { id: 'stu-1' },
        data: { level: 'INTERMEDIATE' }
      });
      expect(result.resultLevel).toBe('INTERMEDIATE');
      const monthsBetween =
        (result.nextReviewDue.getFullYear() - result.completedAt.getFullYear()) * 12 +
        (result.nextReviewDue.getMonth() - result.completedAt.getMonth());
      expect(monthsBetween).toBe(REVIEW_INTERVAL_MONTHS);
    });

    it('activates a linked enrollment that was awaiting placement', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({
        id: 'pa-1',
        status: 'SCHEDULED',
        studentId: 'stu-1',
        enrollmentId: 'enr-1'
      });
      txEnrollmentFindUnique.mockResolvedValue({ id: 'enr-1', status: 'WAITLISTED', level: null });
      await service.complete('pa-1', { resultLevel: 'NOVICE' }, 'admin-1');
      const arg = txEnrollmentUpdate.mock.calls[0][0];
      expect(arg.data.status).toBe('ACTIVE');
      expect(arg.data.level).toBe('NOVICE');
      expect(arg.data.events.create.type).toBe('PLACED');
    });

    it('logs a LEVEL_CHANGE on a linked active enrollment when the level moves', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({
        id: 'pa-1',
        status: 'SCHEDULED',
        studentId: 'stu-1',
        enrollmentId: 'enr-1'
      });
      txEnrollmentFindUnique.mockResolvedValue({ id: 'enr-1', status: 'ACTIVE', level: 'NOVICE' });
      await service.complete('pa-1', { resultLevel: 'ADVANCED' }, 'admin-1');
      const arg = txEnrollmentUpdate.mock.calls[0][0];
      expect(arg.data.status).toBeUndefined();
      expect(arg.data.level).toBe('ADVANCED');
      expect(arg.data.events.create.type).toBe('LEVEL_CHANGE');
    });

    it('leaves a linked active enrollment untouched when the level is unchanged', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({
        id: 'pa-1',
        status: 'SCHEDULED',
        studentId: 'stu-1',
        enrollmentId: 'enr-1'
      });
      txEnrollmentFindUnique.mockResolvedValue({ id: 'enr-1', status: 'ACTIVE', level: 'NOVICE' });
      await service.complete('pa-1', { resultLevel: 'NOVICE' }, 'admin-1');
      expect(txEnrollmentUpdate).not.toHaveBeenCalled();
    });
  });

  describe('cancel / remove', () => {
    it('cancels a scheduled assessment', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({ id: 'pa-1', status: 'SCHEDULED' });
      await service.cancel('pa-1', { notes: 'family withdrew' });
      expect(prisma.placementAssessment.update.mock.calls[0][0].data.status).toBe('CANCELLED');
    });

    it('refuses to delete a completed assessment', async () => {
      prisma.placementAssessment.findUnique.mockResolvedValue({ id: 'pa-1', status: 'COMPLETED' });
      await expect(service.remove('pa-1')).rejects.toThrow(BadRequestException);
    });
  });
});
