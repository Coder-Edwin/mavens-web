import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RateCardsService } from '../rate-cards/rate-cards.service';
import { csvRow, num, round2 } from '../../common/money';
import {
  GenerateEnrollmentInvoiceDto,
  GenerateSchoolGroupInvoiceDto,
  IssueInvoiceDto,
  RecordInvoicePaymentDto,
  UpdateInvoiceDto
} from './dto/invoice.dto';

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID'];
const DEFAULT_TERMS_DAYS = 14;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthSpan(a: Date, b: Date): number {
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
}

interface DraftLine {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  rateCardId?: string;
  sessionId?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateCards: RateCardsService
  ) {}

  private readonly detail = {
    lines: { orderBy: { description: 'asc' } },
    payments: { orderBy: { paidAt: 'desc' } },
    enrollment: {
      select: {
        id: true,
        deliveryType: true,
        level: true,
        student: { select: { id: true, firstName: true, lastName: true } }
      }
    },
    schoolGroup: { select: { id: true, institutionName: true } },
    billTo: { select: { id: true, email: true } }
  } satisfies Prisma.InvoiceInclude;

  async generateForEnrollment(dto: GenerateEnrollmentInvoiceDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: {
        student: {
          select: {
            id: true,
            parentLinks: { select: { parent: { select: { userId: true } } } }
          }
        }
      }
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) throw new BadRequestException('periodEnd is before periodStart');

    const card = await this.rateCards.resolve(
      {
        deliveryType: enrollment.deliveryType,
        level: enrollment.level ?? null,
        clientType: enrollment.clientType
      },
      periodEnd
    );
    if (!card) {
      throw new BadRequestException('No active rate card matches this enrollment for that date');
    }
    const unit = num(card.amount);

    let lines: DraftLine[] = [];
    if (card.unit === 'PER_SESSION') {
      const attended = await this.prisma.sessionAttendance.findMany({
        where: {
          present: true,
          studentId: enrollment.studentId,
          session: { status: 'COMPLETED', date: { gte: periodStart, lte: periodEnd } }
        },
        include: { session: { select: { id: true, topic: true, date: true } } }
      });
      attended.sort((a, b) => a.session.date.getTime() - b.session.date.getTime());
      lines = attended.map((a) => ({
        description: `Session — ${a.session.topic} (${fmtDate(a.session.date)})`,
        quantity: 1,
        unitAmount: unit,
        amount: unit,
        rateCardId: card.id,
        sessionId: a.session.id
      }));
    } else if (card.unit === 'PER_MONTH') {
      const months = monthSpan(periodStart, periodEnd);
      lines = [
        {
          description: `Monthly coaching — ${fmtDate(periodStart)} to ${fmtDate(periodEnd)}`,
          quantity: months,
          unitAmount: unit,
          amount: round2(unit * months),
          rateCardId: card.id
        }
      ];
    } else {
      lines = [
        {
          description: `Term coaching — ${fmtDate(periodStart)} to ${fmtDate(periodEnd)}`,
          quantity: 1,
          unitAmount: unit,
          amount: unit,
          rateCardId: card.id
        }
      ];
    }

    if (lines.length === 0) {
      throw new BadRequestException('No billable sessions in this period');
    }

    const billToUserId = enrollment.student.parentLinks[0]?.parent.userId ?? null;
    return this.persist({
      enrollmentId: enrollment.id,
      schoolGroupId: null,
      billToUserId,
      periodStart,
      periodEnd,
      currency: card.currency,
      notes: dto.notes?.trim() || null,
      lines
    });
  }

  async generateForSchoolGroup(dto: GenerateSchoolGroupInvoiceDto) {
    const group = await this.prisma.schoolGroup.findUnique({ where: { id: dto.schoolGroupId } });
    if (!group) throw new NotFoundException('School group not found');

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) throw new BadRequestException('periodEnd is before periodStart');

    const card = await this.rateCards.resolve(
      { deliveryType: 'SCHOOL_GROUP', level: null, clientType: 'INSTITUTION' },
      periodEnd
    );
    if (!card) {
      throw new BadRequestException('No active SCHOOL_GROUP rate card for that date');
    }
    const unit = num(card.amount);

    let lines: DraftLine[] = [];
    if (card.unit === 'PER_SESSION') {
      const sessions = await this.prisma.session.findMany({
        where: {
          status: 'COMPLETED',
          date: { gte: periodStart, lte: periodEnd },
          classSchedule: { schoolGroupId: group.id }
        },
        orderBy: { date: 'asc' },
        select: { id: true, topic: true, date: true }
      });
      lines = sessions.map((s) => ({
        description: `Session — ${s.topic} (${fmtDate(s.date)})`,
        quantity: 1,
        unitAmount: unit,
        amount: unit,
        rateCardId: card.id,
        sessionId: s.id
      }));
    } else {
      const months = card.unit === 'PER_MONTH' ? monthSpan(periodStart, periodEnd) : 1;
      lines = [
        {
          description: `${group.institutionName} coaching — ${fmtDate(periodStart)} to ${fmtDate(periodEnd)}`,
          quantity: months,
          unitAmount: unit,
          amount: round2(unit * months),
          rateCardId: card.id
        }
      ];
    }

    if (lines.length === 0) {
      throw new BadRequestException('No billable sessions in this period');
    }

    return this.persist({
      enrollmentId: null,
      schoolGroupId: group.id,
      billToUserId: null,
      periodStart,
      periodEnd,
      currency: card.currency,
      notes: dto.notes?.trim() || null,
      lines
    });
  }

  private async persist(args: {
    enrollmentId: string | null;
    schoolGroupId: string | null;
    billToUserId: string | null;
    periodStart: Date;
    periodEnd: Date;
    currency: string;
    notes: string | null;
    lines: DraftLine[];
  }) {
    const subtotal = round2(args.lines.reduce((s, l) => s + l.amount, 0));
    const year = args.periodEnd.getFullYear();

    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
      const number = `INV-${year}-${String(seq + 1).padStart(4, '0')}`;
      return tx.invoice.create({
        data: {
          number,
          enrollmentId: args.enrollmentId,
          schoolGroupId: args.schoolGroupId,
          billToUserId: args.billToUserId,
          periodStart: args.periodStart,
          periodEnd: args.periodEnd,
          currency: args.currency,
          subtotal,
          total: subtotal,
          notes: args.notes,
          lines: {
            create: args.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitAmount: l.unitAmount,
              amount: l.amount,
              rateCardId: l.rateCardId ?? null,
              sessionId: l.sessionId ?? null
            }))
          }
        },
        include: this.detail
      });
    });
  }

  findAll(filters: { status?: string; enrollmentId?: string; schoolGroupId?: string } = {}) {
    const where: Prisma.InvoiceWhereInput = {};
    if (filters.status && INVOICE_STATUSES.includes(filters.status)) {
      where.status = filters.status as Prisma.InvoiceWhereInput['status'];
    }
    if (filters.enrollmentId) where.enrollmentId = filters.enrollmentId;
    if (filters.schoolGroupId) where.schoolGroupId = filters.schoolGroupId;
    return this.prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.detail
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: this.detail });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async issue(id: string, dto: IssueInvoiceDto) {
    const invoice = await this.load(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft invoice can be issued');
    }
    const dueAt = dto.dueAt
      ? new Date(dto.dueAt)
      : new Date(Date.now() + DEFAULT_TERMS_DAYS * 24 * 60 * 60 * 1000);
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT', issuedAt: new Date(), dueAt },
      include: this.detail
    });
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.load(id);
    if (invoice.status === 'PAID' || invoice.status === 'VOID') {
      throw new BadRequestException('This invoice can no longer be edited');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: {
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      },
      include: this.detail
    });
  }

  async recordPayment(id: string, dto: RecordInvoicePaymentDto) {
    const invoice = await this.load(id);
    if (invoice.status === 'VOID') throw new BadRequestException('This invoice is void');
    if (invoice.status === 'PAID') throw new BadRequestException('This invoice is already paid');

    const nextPaid = round2(num(invoice.amountPaid) + dto.amount);
    const total = num(invoice.total);
    const status = nextPaid >= total ? 'PAID' : nextPaid > 0 ? 'PARTIAL' : invoice.status;

    return this.prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          invoiceId: id,
          amount: dto.amount,
          method: dto.method ?? 'MPESA',
          reference: dto.reference?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
          notes: dto.notes?.trim() || null
        }
      });
      return tx.invoice.update({
        where: { id },
        data: { amountPaid: nextPaid, status },
        include: this.detail
      });
    });
  }

  async voidInvoice(id: string) {
    const invoice = await this.load(id);
    if (invoice.status === 'PAID') throw new BadRequestException('A paid invoice cannot be voided');
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'VOID' },
      include: this.detail
    });
  }

  async remove(id: string) {
    const invoice = await this.load(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft invoice can be deleted — void it instead.');
    }
    await this.prisma.invoice.delete({ where: { id } });
    return { id };
  }

  async exportCsv(filters: { status?: string; from?: string; to?: string } = {}): Promise<string> {
    const where: Prisma.InvoiceWhereInput = {};
    if (filters.status && INVOICE_STATUSES.includes(filters.status)) {
      where.status = filters.status as Prisma.InvoiceWhereInput['status'];
    }
    if (filters.from || filters.to) {
      where.periodEnd = {};
      if (filters.from) where.periodEnd.gte = new Date(filters.from);
      if (filters.to) where.periodEnd.lte = new Date(filters.to);
    }
    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        enrollment: { select: { student: { select: { firstName: true, lastName: true } } } },
        schoolGroup: { select: { institutionName: true } }
      }
    });

    const header = [
      'number',
      'billTo',
      'periodStart',
      'periodEnd',
      'status',
      'currency',
      'subtotal',
      'total',
      'amountPaid',
      'issuedAt',
      'dueAt'
    ];
    const rows = invoices.map((inv) => {
      const billTo = inv.enrollment
        ? `${inv.enrollment.student.firstName} ${inv.enrollment.student.lastName}`
        : (inv.schoolGroup?.institutionName ?? '');
      return csvRow([
        inv.number,
        billTo,
        fmtDate(inv.periodStart),
        fmtDate(inv.periodEnd),
        inv.status,
        inv.currency,
        num(inv.subtotal).toFixed(2),
        num(inv.total).toFixed(2),
        num(inv.amountPaid).toFixed(2),
        inv.issuedAt ? fmtDate(inv.issuedAt) : '',
        inv.dueAt ? fmtDate(inv.dueAt) : ''
      ]);
    });
    return [csvRow(header), ...rows].join('\n');
  }

  private async load(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
