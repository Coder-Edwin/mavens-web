import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { csvRow, num, round2 } from '../../common/money';
import { GeneratePayoutDto } from './dto/payout.dto';

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly detail = {
    items: {
      orderBy: { amount: 'desc' as const },
      include: {
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } }
          }
        }
      }
    }
  };

  async generate(dto: GeneratePayoutDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) throw new BadRequestException('periodEnd is before periodStart');

    // Pull the actual sessions rather than a flat groupBy count: a
    // classSchedule can carry its own payoutRate (e.g. a HOME visit paying
    // more than a CENTER session to cover travel), so two sessions for the
    // same coach in the same period can legitimately pay different amounts.
    const sessions = await this.prisma.session.findMany({
      where: { status: 'COMPLETED', date: { gte: periodStart, lte: periodEnd } },
      select: {
        coachId: true,
        classSchedule: { select: { payoutRate: true } }
      }
    });
    if (sessions.length === 0) {
      throw new BadRequestException('No completed sessions in this period');
    }

    const coachIds = [...new Set(sessions.map((s) => s.coachId))];
    const coaches = await this.prisma.coachProfile.findMany({
      where: { id: { in: coachIds } },
      select: { id: true, sessionRate: true }
    });
    const flatRateById = new Map(coaches.map((c) => [c.id, num(c.sessionRate)]));

    const byCoach = new Map<string, { count: number; amount: number; anyRateMissing: boolean }>();
    for (const s of sessions) {
      const flatRate = flatRateById.get(s.coachId) ?? 0;
      const rate = s.classSchedule?.payoutRate != null ? num(s.classSchedule.payoutRate) : flatRate;
      const entry = byCoach.get(s.coachId) ?? { count: 0, amount: 0, anyRateMissing: false };
      entry.count += 1;
      entry.amount += rate;
      if (rate <= 0) entry.anyRateMissing = true;
      byCoach.set(s.coachId, entry);
    }

    const items = [...byCoach.entries()].map(([coachId, agg]) => ({
      coachId,
      sessionCount: agg.count,
      // Sessions for the same coach may carry mixed rates (schedule override
      // vs. flat rate); store the average per-session rate for display.
      ratePerSession: round2(agg.amount / agg.count),
      amount: round2(agg.amount),
      notes: agg.anyRateMissing ? 'No session rate set for at least one session' : null
    }));

    return this.prisma.payoutRun.create({
      data: {
        periodStart,
        periodEnd,
        notes: dto.notes?.trim() || null,
        items: { create: items }
      },
      include: this.detail
    });
  }

  findAll(status?: string) {
    const where =
      status && ['DRAFT', 'APPROVED', 'PAID'].includes(status)
        ? { status: status as 'DRAFT' | 'APPROVED' | 'PAID' }
        : undefined;
    return this.prisma.payoutRun.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      include: { _count: { select: { items: true } } }
    });
  }

  async findOne(id: string) {
    const run = await this.prisma.payoutRun.findUnique({ where: { id }, include: this.detail });
    if (!run) throw new NotFoundException('Payout run not found');
    return run;
  }

  async approve(id: string) {
    const run = await this.load(id);
    if (run.status !== 'DRAFT') throw new BadRequestException('Only a draft run can be approved');
    return this.prisma.payoutRun.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: this.detail
    });
  }

  async markPaid(id: string) {
    const run = await this.load(id);
    if (run.status !== 'APPROVED') {
      throw new BadRequestException('Approve the run before marking it paid');
    }
    return this.prisma.payoutRun.update({
      where: { id },
      data: { status: 'PAID' },
      include: this.detail
    });
  }

  async remove(id: string) {
    const run = await this.load(id);
    if (run.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft run can be deleted');
    }
    await this.prisma.payoutRun.delete({ where: { id } });
    return { id };
  }

  async exportCsv(id: string): Promise<string> {
    const run = await this.prisma.payoutRun.findUnique({ where: { id }, include: this.detail });
    if (!run) throw new NotFoundException('Payout run not found');

    const header = ['coach', 'email', 'sessions', 'ratePerSession', 'amount'];
    const rows = run.items.map((it) => {
      const name =
        [it.coach.firstName, it.coach.lastName].filter(Boolean).join(' ') ||
        it.coach.user?.email ||
        it.coachId;
      return csvRow([
        name,
        it.coach.user?.email ?? '',
        it.sessionCount,
        num(it.ratePerSession).toFixed(2),
        num(it.amount).toFixed(2)
      ]);
    });
    const total = run.items.reduce((s, it) => s + num(it.amount), 0);
    return [
      `Payout run ${fmtDate(run.periodStart)} to ${fmtDate(run.periodEnd)} (${run.status})`,
      csvRow(header),
      ...rows,
      csvRow(['TOTAL', '', '', '', total.toFixed(2)])
    ].join('\n');
  }

  private async load(id: string) {
    const run = await this.prisma.payoutRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payout run not found');
    return run;
  }
}
