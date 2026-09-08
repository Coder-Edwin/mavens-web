import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClassSchedulesService } from './class-schedules.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ClassSchedulesService', () => {
  let service: ClassSchedulesService;
  let prisma: any;

  const schedule = (over: Record<string, unknown> = {}) => ({
    id: 'cs-1',
    title: 'Saturday Novices',
    deliveryType: 'CENTER',
    schoolGroupId: null,
    level: 'NOVICE',
    coachId: 'coach-1',
    venue: 'Westlands Centre',
    weekday: 6, // Saturday
    startTime: '10:00',
    durationMinutes: 90,
    termId: null,
    startDate: new Date('2026-01-01'),
    endDate: null,
    status: 'ACTIVE',
    capacity: 12,
    notes: null,
    ...over
  });

  beforeEach(async () => {
    prisma = {
      classSchedule: {
        create: jest.fn((a: any) => Promise.resolve({ id: 'cs-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      },
      coachProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      schoolGroup: { findUnique: jest.fn().mockResolvedValue({ id: 'sg-1' }) },
      term: { findUnique: jest.fn() },
      session: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClassSchedulesService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(ClassSchedulesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('requires a schoolGroupId for a SCHOOL_GROUP schedule', async () => {
      await expect(
        service.create({
          title: 'X',
          deliveryType: 'SCHOOL_GROUP',
          weekday: 3,
          startTime: '14:00',
          startDate: '2026-02-01'
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown coach', async () => {
      prisma.coachProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          title: 'X',
          deliveryType: 'CENTER',
          coachId: 'ghost',
          weekday: 3,
          startTime: '14:00',
          startDate: '2026-02-01'
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('creates an ACTIVE schedule with a 60-minute default duration', async () => {
      await service.create({
        title: '  Wed Intermediate  ',
        deliveryType: 'CENTER',
        weekday: 3,
        startTime: '15:30',
        startDate: '2026-02-01'
      });
      const data = prisma.classSchedule.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        title: 'Wed Intermediate',
        status: 'ACTIVE',
        durationMinutes: 60,
        weekday: 3,
        startTime: '15:30'
      });
    });
  });

  describe('generate', () => {
    it('refuses a non-ACTIVE schedule', async () => {
      prisma.classSchedule.findUnique.mockResolvedValue(schedule({ status: 'PAUSED' }));
      await expect(service.generate('cs-1', {})).rejects.toThrow(BadRequestException);
    });

    it('refuses a schedule with no coach', async () => {
      prisma.classSchedule.findUnique.mockResolvedValue(schedule({ coachId: null }));
      await expect(service.generate('cs-1', {})).rejects.toThrow(BadRequestException);
    });

    it('creates one SCHEDULED session per matching weekday in the window', async () => {
      prisma.classSchedule.findUnique.mockResolvedValue(schedule());
      const res = await service.generate('cs-1', { from: '2026-06-01T00:00:00', to: '2026-06-30T00:00:00' });

      // Saturdays in June 2026: 6, 13, 20, 27 -> 4 sessions
      expect(res.created).toBe(4);
      expect(res.skipped).toBe(0);
      const rows = prisma.session.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(row.status).toBe('SCHEDULED');
        expect(row.coachId).toBe('coach-1');
        expect(row.classScheduleId).toBe('cs-1');
        expect(row.topic).toBe('Saturday Novices');
        expect(new Date(row.startsAt).getDay()).toBe(6);
        expect(new Date(row.endsAt).getTime() - new Date(row.startsAt).getTime()).toBe(90 * 60_000);
      }
    });

    it('skips days that already have a session for this schedule', async () => {
      prisma.classSchedule.findUnique.mockResolvedValue(schedule());
      prisma.session.findMany.mockResolvedValue([{ date: new Date('2026-06-13T00:00:00') }]);
      const res = await service.generate('cs-1', { from: '2026-06-01T00:00:00', to: '2026-06-30T00:00:00' });
      expect(res.created).toBe(3);
      expect(res.skipped).toBe(1);
    });

    it('clamps the window to the term bounds', async () => {
      prisma.classSchedule.findUnique.mockResolvedValue(schedule({ termId: 'term-1' }));
      prisma.term.findUnique.mockResolvedValue({
        id: 'term-1',
        startDate: new Date('2026-06-10T12:00:00'),
        endDate: new Date('2026-06-18T12:00:00')
      });
      const res = await service.generate('cs-1', { from: '2026-06-01T00:00:00', to: '2026-06-30T00:00:00' });
      // Saturday 2026-06-13 is the only matching day inside 10th–18th
      expect(res.created).toBe(1);
    });
  });

  describe('remove', () => {
    it('refuses to delete a schedule that already generated sessions', async () => {
      prisma.classSchedule.findUnique.mockResolvedValue({ id: 'cs-1', _count: { sessions: 5 } });
      await expect(service.remove('cs-1')).rejects.toThrow(BadRequestException);
    });
  });
});
