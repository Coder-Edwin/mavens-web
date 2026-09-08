import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { csvRow, num, round2 } from '../../common/money';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function tallyBy<T extends string>(rows: { key: T; count: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.key] = r.count;
  return out;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const monthStart = startOfMonth();

    const [
      studentTotal,
      studentsByLevelRaw,
      enrollmentsByStatusRaw,
      enrollmentsByDeliveryRaw,
      coachesByEmploymentRaw,
      activeSchedules,
      sessionsThisMonthRaw,
      placementsScheduled,
      overdueReviews,
      invoicesByStatusRaw,
      billableInvoices,
      paymentsAgg,
      latestPayout,
      approvedPayoutItems,
      leadsByStatusRaw
    ] = await Promise.all([
      this.prisma.studentProfile.count(),
      this.prisma.studentProfile.groupBy({ by: ['level'], _count: { _all: true } }),
      this.prisma.enrollment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.enrollment.groupBy({ by: ['deliveryType'], _count: { _all: true } }),
      this.prisma.coachProfile.groupBy({ by: ['employmentType'], _count: { _all: true } }),
      this.prisma.classSchedule.count({ where: { status: 'ACTIVE' } }),
      this.prisma.session.groupBy({
        by: ['status'],
        where: { date: { gte: monthStart } },
        _count: { _all: true }
      }),
      this.prisma.placementAssessment.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.placementAssessment.count({
        where: { status: 'COMPLETED', nextReviewDue: { lt: new Date() } }
      }),
      this.prisma.invoice.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.invoice.findMany({
        where: { status: { in: ['SENT', 'PARTIAL'] } },
        select: { total: true, amountPaid: true }
      }),
      this.prisma.invoicePayment.aggregate({ _sum: { amount: true } }),
      this.prisma.payoutRun.findFirst({
        orderBy: { periodStart: 'desc' },
        include: { items: { select: { amount: true } } }
      }),
      this.prisma.payoutItem.findMany({
        where: { payoutRun: { status: 'APPROVED' } },
        select: { amount: true }
      }),
      this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } })
    ]);

    const outstanding = round2(
      billableInvoices.reduce((s, i) => s + (num(i.total) - num(i.amountPaid)), 0)
    );
    const latestPayoutTotal = latestPayout
      ? round2(latestPayout.items.reduce((s, it) => s + num(it.amount), 0))
      : 0;
    const unpaidApprovedPayouts = round2(
      approvedPayoutItems.reduce((s, it) => s + num(it.amount), 0)
    );

    return {
      students: {
        total: studentTotal,
        byLevel: tallyBy(
          studentsByLevelRaw.map((r) => ({ key: r.level ?? 'UNPLACED', count: r._count._all }))
        )
      },
      enrollments: {
        byStatus: tallyBy(
          enrollmentsByStatusRaw.map((r) => ({ key: r.status, count: r._count._all }))
        ),
        byDelivery: tallyBy(
          enrollmentsByDeliveryRaw.map((r) => ({ key: r.deliveryType, count: r._count._all }))
        )
      },
      coaches: {
        byEmployment: tallyBy(
          coachesByEmploymentRaw.map((r) => ({ key: r.employmentType, count: r._count._all }))
        )
      },
      schedule: {
        activeSchedules,
        sessionsThisMonth: tallyBy(
          sessionsThisMonthRaw.map((r) => ({ key: r.status, count: r._count._all }))
        )
      },
      placements: { scheduled: placementsScheduled, overdueReviews },
      billing: {
        invoicesByStatus: tallyBy(
          invoicesByStatusRaw.map((r) => ({ key: r.status, count: r._count._all }))
        ),
        outstanding,
        paymentsReceivedAllTime: round2(num(paymentsAgg._sum.amount))
      },
      payouts: { latestRunTotal: latestPayoutTotal, unpaidApprovedTotal: unpaidApprovedPayouts },
      leads: {
        byStatus: tallyBy(leadsByStatusRaw.map((r) => ({ key: r.status, count: r._count._all })))
      }
    };
  }

  /// Monthly invoiced / paid / outstanding within a window (defaults to the
  /// last 6 months). Buckets on the invoice period end.
  async revenue(fromISO?: string, toISO?: string) {
    const to = toISO ? new Date(toISO) : new Date();
    const from = fromISO ? new Date(fromISO) : new Date(to.getFullYear(), to.getMonth() - 5, 1);

    const invoices = await this.prisma.invoice.findMany({
      where: { periodEnd: { gte: from, lte: to }, status: { not: 'VOID' } },
      select: { periodEnd: true, total: true, amountPaid: true }
    });

    const buckets = new Map<string, { invoiced: number; paid: number }>();
    // seed every month in range so gaps show as zero
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      buckets.set(monthKey(cursor), { invoiced: 0, paid: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const inv of invoices) {
      const k = monthKey(inv.periodEnd);
      const b = buckets.get(k) ?? { invoiced: 0, paid: 0 };
      b.invoiced += num(inv.total);
      b.paid += num(inv.amountPaid);
      buckets.set(k, b);
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, b]) => ({
        month,
        invoiced: round2(b.invoiced),
        paid: round2(b.paid),
        outstanding: round2(b.invoiced - b.paid)
      }));
  }

  /// Per-coach: completed sessions, distinct students taught, and the payout
  /// that would be due at the coach's current session rate, within a window
  /// (defaults to the current month).
  async coachActivity(fromISO?: string, toISO?: string) {
    const from = fromISO ? new Date(fromISO) : startOfMonth();
    const to = toISO ? new Date(toISO) : new Date();

    const sessions = await this.prisma.session.findMany({
      where: { status: 'COMPLETED', date: { gte: from, lte: to } },
      select: {
        coachId: true,
        attendance: { where: { present: true }, select: { studentId: true } }
      }
    });

    const coaches = await this.prisma.coachProfile.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sessionRate: true,
        user: { select: { email: true } }
      }
    });

    const byCoach = new Map<string, { sessions: number; students: Set<string> }>();
    for (const s of sessions) {
      const entry = byCoach.get(s.coachId) ?? { sessions: 0, students: new Set<string>() };
      entry.sessions += 1;
      for (const a of s.attendance) entry.students.add(a.studentId);
      byCoach.set(s.coachId, entry);
    }

    return coaches
      .map((c) => {
        const e = byCoach.get(c.id) ?? { sessions: 0, students: new Set<string>() };
        const rate = num(c.sessionRate);
        return {
          coachId: c.id,
          name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.user?.email || c.id,
          sessions: e.sessions,
          studentsTaught: e.students.size,
          sessionRate: rate,
          payoutDue: round2(rate * e.sessions)
        };
      })
      .filter((r) => r.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions);
  }

  async enrollmentFunnel() {
    const [leadsByStatus, placementsScheduled, placementsCompleted, activeEnrollments, allEnrollments] =
      await Promise.all([
        this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.placementAssessment.count({ where: { status: 'SCHEDULED' } }),
        this.prisma.placementAssessment.count({ where: { status: 'COMPLETED' } }),
        this.prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
        this.prisma.enrollment.count()
      ]);

    const leads = tallyBy(leadsByStatus.map((r) => ({ key: r.status, count: r._count._all })));
    const leadTotal = Object.values(leads).reduce((s, n) => s + n, 0);

    return {
      leads: { total: leadTotal, byStatus: leads, converted: leads.ENROLLED ?? 0 },
      placements: { scheduled: placementsScheduled, completed: placementsCompleted },
      enrollments: { total: allEnrollments, active: activeEnrollments }
    };
  }

  // ---------- CSV exports ----------

  async studentsCsv(): Promise<string> {
    const students = await this.prisma.studentProfile.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        enrollments: { select: { status: true } },
        parentLinks: {
          select: { parent: { select: { phone: true, user: { select: { email: true } } } } }
        }
      }
    });
    const header = ['firstName', 'lastName', 'level', 'activeEnrollments', 'joinedAt', 'parentEmail', 'parentPhone'];
    const rows = students.map((s) => {
      const parent = s.parentLinks[0]?.parent;
      return csvRow([
        s.firstName,
        s.lastName,
        s.level ?? '',
        s.enrollments.filter((e) => e.status === 'ACTIVE').length,
        s.joinedAt.toISOString().slice(0, 10),
        parent?.user?.email ?? '',
        parent?.phone ?? ''
      ]);
    });
    return [csvRow(header), ...rows].join('\n');
  }

  async enrollmentsCsv(): Promise<string> {
    const enrollments = await this.prisma.enrollment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { firstName: true, lastName: true } },
        schoolGroup: { select: { institutionName: true } },
        assignedCoach: { select: { firstName: true, lastName: true, user: { select: { email: true } } } }
      }
    });
    const header = ['student', 'deliveryType', 'clientType', 'level', 'status', 'coach', 'schoolGroup', 'startDate', 'endDate'];
    const rows = enrollments.map((e) =>
      csvRow([
        `${e.student.firstName} ${e.student.lastName}`,
        e.deliveryType,
        e.clientType,
        e.level ?? '',
        e.status,
        e.assignedCoach
          ? [e.assignedCoach.firstName, e.assignedCoach.lastName].filter(Boolean).join(' ') ||
            (e.assignedCoach.user?.email ?? '')
          : '',
        e.schoolGroup?.institutionName ?? '',
        e.startDate.toISOString().slice(0, 10),
        e.endDate ? e.endDate.toISOString().slice(0, 10) : ''
      ])
    );
    return [csvRow(header), ...rows].join('\n');
  }

  async attendanceCsv(fromISO?: string, toISO?: string): Promise<string> {
    const from = fromISO ? new Date(fromISO) : startOfMonth();
    const to = toISO ? new Date(toISO) : new Date();
    const sessions = await this.prisma.session.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      include: {
        coach: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
        attendance: {
          include: { student: { select: { firstName: true, lastName: true } } }
        }
      }
    });
    const header = ['date', 'topic', 'status', 'coach', 'student', 'present'];
    const rows: string[] = [];
    for (const s of sessions) {
      const coach =
        [s.coach.firstName, s.coach.lastName].filter(Boolean).join(' ') || (s.coach.user?.email ?? '');
      if (s.attendance.length === 0) {
        rows.push(csvRow([s.date.toISOString().slice(0, 10), s.topic, s.status, coach, '', '']));
      }
      for (const a of s.attendance) {
        rows.push(
          csvRow([
            s.date.toISOString().slice(0, 10),
            s.topic,
            s.status,
            coach,
            `${a.student.firstName} ${a.student.lastName}`,
            a.present ? 'yes' : 'no'
          ])
        );
      }
    }
    return [csvRow(header), ...rows].join('\n');
  }
}
