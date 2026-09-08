import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      studentProfile: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
      enrollment: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      coachProfile: { groupBy: jest.fn(), findMany: jest.fn() },
      classSchedule: { count: jest.fn() },
      session: { groupBy: jest.fn(), findMany: jest.fn() },
      placementAssessment: { count: jest.fn() },
      invoice: { groupBy: jest.fn(), findMany: jest.fn() },
      invoicePayment: { aggregate: jest.fn() },
      payoutRun: { findFirst: jest.fn() },
      payoutItem: { findMany: jest.fn() },
      lead: { groupBy: jest.fn() }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(ReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('overview', () => {
    it('shapes counts and computes outstanding + payout totals', async () => {
      prisma.studentProfile.count.mockResolvedValue(20);
      prisma.studentProfile.groupBy.mockResolvedValue([
        { level: 'NOVICE', _count: { _all: 8 } },
        { level: null, _count: { _all: 5 } }
      ]);
      prisma.enrollment.groupBy
        .mockResolvedValueOnce([{ status: 'ACTIVE', _count: { _all: 12 } }])
        .mockResolvedValueOnce([{ deliveryType: 'CENTER', _count: { _all: 12 } }]);
      prisma.coachProfile.groupBy.mockResolvedValue([{ employmentType: 'STAFF', _count: { _all: 3 } }]);
      prisma.classSchedule.count.mockResolvedValue(4);
      prisma.session.groupBy.mockResolvedValue([{ status: 'COMPLETED', _count: { _all: 30 } }]);
      prisma.placementAssessment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      prisma.invoice.groupBy.mockResolvedValue([{ status: 'SENT', _count: { _all: 5 } }]);
      prisma.invoice.findMany.mockResolvedValue([
        { total: 4500, amountPaid: 2000 },
        { total: 3000, amountPaid: 3000 }
      ]);
      prisma.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 12000 } });
      prisma.payoutRun.findFirst.mockResolvedValue({ items: [{ amount: 7200 }, { amount: 900 }] });
      prisma.payoutItem.findMany.mockResolvedValue([{ amount: 5000 }]);
      prisma.lead.groupBy.mockResolvedValue([
        { status: 'NEW', _count: { _all: 4 } },
        { status: 'ENROLLED', _count: { _all: 6 } }
      ]);

      const r = await service.overview();
      expect(r.students).toEqual({ total: 20, byLevel: { NOVICE: 8, UNPLACED: 5 } });
      expect(r.billing.outstanding).toBe(2500); // (4500-2000) + (3000-3000)
      expect(r.billing.paymentsReceivedAllTime).toBe(12000);
      expect(r.payouts.latestRunTotal).toBe(8100);
      expect(r.payouts.unpaidApprovedTotal).toBe(5000);
      expect(r.leads.byStatus).toEqual({ NEW: 4, ENROLLED: 6 });
    });
  });

  describe('revenue', () => {
    it('buckets invoiced/paid by month and fills gaps with zero', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        { periodEnd: new Date('2026-06-30'), total: 5000, amountPaid: 5000 },
        { periodEnd: new Date('2026-06-15'), total: 1000, amountPaid: 0 },
        { periodEnd: new Date('2026-08-10'), total: 2000, amountPaid: 1000 }
      ]);
      const rows = await service.revenue('2026-06-01', '2026-08-31');
      expect(rows.map((r) => r.month)).toEqual(['2026-06', '2026-07', '2026-08']);
      expect(rows[0]).toEqual({ month: '2026-06', invoiced: 6000, paid: 5000, outstanding: 1000 });
      expect(rows[1]).toEqual({ month: '2026-07', invoiced: 0, paid: 0, outstanding: 0 });
      expect(rows[2]).toEqual({ month: '2026-08', invoiced: 2000, paid: 1000, outstanding: 1000 });
    });
  });

  describe('coachActivity', () => {
    it('counts completed sessions and distinct students, and computes payout due', async () => {
      prisma.session.findMany.mockResolvedValue([
        { coachId: 'c1', attendance: [{ studentId: 's1' }, { studentId: 's2' }] },
        { coachId: 'c1', attendance: [{ studentId: 's2' }, { studentId: 's3' }] },
        { coachId: 'c2', attendance: [{ studentId: 's4' }] }
      ]);
      prisma.coachProfile.findMany.mockResolvedValue([
        { id: 'c1', firstName: 'Bri', lastName: 'O', sessionRate: 900, user: { email: 'b@x' } },
        { id: 'c2', firstName: null, lastName: null, sessionRate: null, user: { email: 'c@x' } },
        { id: 'c3', firstName: 'Idle', lastName: 'Coach', sessionRate: 500, user: { email: 'i@x' } }
      ]);
      const rows = await service.coachActivity('2026-06-01', '2026-06-30');
      expect(rows).toHaveLength(2); // c3 had no sessions -> filtered out
      expect(rows[0]).toMatchObject({ coachId: 'c1', sessions: 2, studentsTaught: 3, payoutDue: 1800 });
      expect(rows[1]).toMatchObject({ coachId: 'c2', name: 'c@x', sessions: 1, payoutDue: 0 });
    });
  });

  describe('enrollmentFunnel', () => {
    it('summarises leads -> placements -> enrollments', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { status: 'NEW', _count: { _all: 3 } },
        { status: 'CONTACTED', _count: { _all: 2 } },
        { status: 'ENROLLED', _count: { _all: 5 } }
      ]);
      prisma.placementAssessment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(7);
      prisma.enrollment.count.mockResolvedValueOnce(6).mockResolvedValueOnce(9);

      const f = await service.enrollmentFunnel();
      expect(f.leads).toEqual({ total: 10, byStatus: { NEW: 3, CONTACTED: 2, ENROLLED: 5 }, converted: 5 });
      expect(f.placements).toEqual({ scheduled: 2, completed: 7 });
      expect(f.enrollments).toEqual({ total: 9, active: 6 });
    });
  });

  describe('studentsCsv', () => {
    it('emits a header row and one row per student', async () => {
      prisma.studentProfile.findMany.mockResolvedValue([
        {
          firstName: 'Faith',
          lastName: 'Wambui',
          level: 'NOVICE',
          joinedAt: new Date('2026-01-05'),
          enrollments: [{ status: 'ACTIVE' }, { status: 'WITHDRAWN' }],
          parentLinks: [{ parent: { phone: '0700', user: { email: 'p@x' } } }]
        }
      ]);
      const csv = await service.studentsCsv();
      const [header, row] = csv.split('\n');
      expect(header).toBe('firstName,lastName,level,activeEnrollments,joinedAt,parentEmail,parentPhone');
      expect(row).toBe('Faith,Wambui,NOVICE,1,2026-01-05,p@x,0700');
    });
  });
});
