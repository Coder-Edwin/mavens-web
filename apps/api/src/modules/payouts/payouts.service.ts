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

    const grouped = await this.prisma.session.groupBy({
      by: ['coachId'],
      where: { status: 'COMPLETED', date: { gte: periodStart, lte: periodEnd } },
      _count: { _all: true }
    });
    if (grouped.length === 0) {
      throw new BadRequestException('No completed sessions in this period');
    }

    const coaches = await this.prisma.coachProfile.findMany({
      where: { id: { in: grouped.map((g) => g.coachId) } },
      select: { id: true, sessionRate: true }
    });
    const rateById = new Map(coaches.map((c) => [c.id, num(c.sessionRate)]));

    const items = grouped.map((g) => {
      const rate = rateById.get(g.coachId) ?? 0;
      const count = g._count._all;
      return {
        coachId: g.coachId,
        sessionCount: count,
        ratePerSession: rate,
        amount: round2(rate * count),
        notes: rate > 0 ? null : 'No session rate set for this coach'
      };
    });

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
