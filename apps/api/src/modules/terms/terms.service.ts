import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTermDto, TERM_STATUSES, UpdateTermDto, type TermStatus } from './dto/term.dto';

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertRange(startISO?: string, endISO?: string, existing?: { startDate: Date; endDate: Date }) {
    const start = startISO ? new Date(startISO) : existing?.startDate;
    const end = endISO ? new Date(endISO) : existing?.endDate;
    if (start && end && end.getTime() <= start.getTime()) {
      throw new BadRequestException('A term must end after it starts');
    }
  }

  async create(dto: CreateTermDto) {
    this.assertRange(dto.startDate, dto.endDate);
    return this.prisma.term.create({
      data: {
        name: dto.name.trim(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status ?? 'PLANNED',
        notes: dto.notes?.trim() || null
      }
    });
  }

  findAll(status?: string) {
    const where =
      status && (TERM_STATUSES as readonly string[]).includes(status)
        ? { status: status as TermStatus }
        : undefined;
    return this.prisma.term.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { schedules: true } } }
    });
  }

  async findOne(id: string) {
    const term = await this.prisma.term.findUnique({
      where: { id },
      include: { _count: { select: { schedules: true } } }
    });
    if (!term) throw new NotFoundException('Term not found');
    return term;
  }

  async update(id: string, dto: UpdateTermDto) {
    const term = await this.findOne(id);
    this.assertRange(dto.startDate, dto.endDate, term);
    return this.prisma.term.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      }
    });
  }

  async remove(id: string) {
    const term = await this.prisma.term.findUnique({
      where: { id },
      include: { _count: { select: { schedules: true } } }
    });
    if (!term) throw new NotFoundException('Term not found');
    if (term._count.schedules > 0) {
      throw new BadRequestException(
        'This term has class schedules — set it to CLOSED instead of deleting it.'
      );
    }
    await this.prisma.term.delete({ where: { id } });
    return { id };
  }
}
