import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateClassScheduleDto,
  GenerateSessionsDto,
  SCHEDULE_STATUSES,
  UpdateClassScheduleDto,
  type ScheduleStatus
} from './dto/class-schedule.dto';

const DEFAULT_HORIZON_DAYS = 28;

// The club runs in a single timezone (server-local). Session times are built
// from the schedule's "HH:MM" in that same local time; nothing here is
// timezone-aware beyond that assumption.
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface FindAllFilters {
  status?: string;
  coachId?: string;
  termId?: string;
  deliveryType?: string;
}

@Injectable()
export class ClassSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    term: { select: { id: true, name: true, startDate: true, endDate: true } },
    coach: {
      select: { id: true, firstName: true, lastName: true, user: { select: { email: true } } }
    },
    schoolGroup: { select: { id: true, institutionName: true } },
    _count: { select: { sessions: true } }
  } satisfies Prisma.ClassScheduleInclude;

  async create(dto: CreateClassScheduleDto) {
    if (dto.deliveryType === 'SCHOOL_GROUP' && !dto.schoolGroupId) {
      throw new BadRequestException('schoolGroupId is required for a SCHOOL_GROUP schedule');
    }
    await this.validateRefs(dto.coachId, dto.schoolGroupId, dto.termId);
    this.assertDateRange(dto.startDate, dto.endDate);

    return this.prisma.classSchedule.create({
      data: {
        title: dto.title.trim(),
        deliveryType: dto.deliveryType,
        schoolGroupId: dto.deliveryType === 'SCHOOL_GROUP' ? dto.schoolGroupId! : null,
        level: dto.level ?? null,
        coachId: dto.coachId ?? null,
        venue: dto.venue?.trim() || null,
        weekday: dto.weekday,
        startTime: dto.startTime,
        durationMinutes: dto.durationMinutes ?? 60,
        termId: dto.termId ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status ?? 'ACTIVE',
        capacity: dto.capacity ?? null,
        notes: dto.notes?.trim() || null
      },
      include: this.include
    });
  }

  findAll(filters: FindAllFilters = {}) {
    const where: Prisma.ClassScheduleWhereInput = {};
    if (filters.status && (SCHEDULE_STATUSES as readonly string[]).includes(filters.status)) {
      where.status = filters.status as ScheduleStatus;
    }
    if (filters.coachId) where.coachId = filters.coachId;
    if (filters.termId) where.termId = filters.termId;
    if (filters.deliveryType && ['HOME', 'CENTER', 'SCHOOL_GROUP'].includes(filters.deliveryType)) {
      where.deliveryType = filters.deliveryType as 'HOME' | 'CENTER' | 'SCHOOL_GROUP';
    }
    return this.prisma.classSchedule.findMany({
      where,
      orderBy: [{ status: 'asc' }, { weekday: 'asc' }, { startTime: 'asc' }],
      include: this.include
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id },
      include: this.include
    });
    if (!schedule) throw new NotFoundException('Class schedule not found');
    return schedule;
  }

  async update(id: string, dto: UpdateClassScheduleDto) {
    const existing = await this.load(id);
    await this.validateRefs(dto.coachId, dto.schoolGroupId, dto.termId);

    const nextDelivery = dto.deliveryType ?? existing.deliveryType;
    if (nextDelivery === 'SCHOOL_GROUP') {
      const groupId = dto.schoolGroupId ?? existing.schoolGroupId;
      if (!groupId) {
        throw new BadRequestException('schoolGroupId is required for a SCHOOL_GROUP schedule');
      }
    }
    this.assertDateRange(
      dto.startDate ?? existing.startDate.toISOString(),
      dto.endDate ?? existing.endDate?.toISOString()
    );

    return this.prisma.classSchedule.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        deliveryType: dto.deliveryType ?? undefined,
        schoolGroupId:
          dto.deliveryType && dto.deliveryType !== 'SCHOOL_GROUP'
            ? null
            : dto.schoolGroupId ?? undefined,
        level: dto.level ?? undefined,
        coachId: dto.coachId ?? undefined,
        venue: dto.venue !== undefined ? dto.venue.trim() || null : undefined,
        weekday: dto.weekday ?? undefined,
        startTime: dto.startTime ?? undefined,
        durationMinutes: dto.durationMinutes ?? undefined,
        termId: dto.termId ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined,
        status: dto.status ?? undefined,
        capacity: dto.capacity ?? undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      },
      include: this.include
    });
  }

  async remove(id: string) {
    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id },
      include: { _count: { select: { sessions: true } } }
    });
    if (!schedule) throw new NotFoundException('Class schedule not found');
    if (schedule._count.sessions > 0) {
      throw new BadRequestException(
        'This schedule already has generated sessions — set it to ENDED instead of deleting it.'
      );
    }
    await this.prisma.classSchedule.delete({ where: { id } });
    return { id };
  }

  /// Materialise concrete Session rows for every matching weekday in the
  /// window. Idempotent: a day that already has a session for this schedule
  /// is left alone.
  async generate(id: string, dto: GenerateSessionsDto) {
    const schedule = await this.load(id);
    if (schedule.status !== 'ACTIVE') {
      throw new BadRequestException('Only an ACTIVE schedule can generate sessions');
    }
    if (!schedule.coachId) {
      throw new BadRequestException('Assign a coach to this schedule before generating sessions');
    }

    let from = dto.from ? startOfDay(new Date(dto.from)) : startOfDay(new Date());
    const scheduleStart = startOfDay(schedule.startDate);
    if (from < scheduleStart) from = scheduleStart;

    let to = dto.to ? startOfDay(new Date(dto.to)) : addDays(from, DEFAULT_HORIZON_DAYS);
    if (schedule.endDate) {
      const scheduleEnd = startOfDay(schedule.endDate);
      if (to > scheduleEnd) to = scheduleEnd;
    }
    if (schedule.termId) {
      const term = await this.prisma.term.findUnique({ where: { id: schedule.termId } });
      if (term) {
        const ts = startOfDay(term.startDate);
        const te = startOfDay(term.endDate);
        if (from < ts) from = ts;
        if (to > te) to = te;
      }
    }

    if (to < from) {
      return { created: 0, skipped: 0, from: from.toISOString(), to: from.toISOString() };
    }

    const existing = await this.prisma.session.findMany({
      where: { classScheduleId: id, date: { gte: from, lte: addDays(to, 1) } },
      select: { date: true }
    });
    const taken = new Set(existing.map((s) => dayKey(s.date)));

    const [hh, mm] = schedule.startTime.split(':').map((n) => Number(n));
    const rows: Prisma.SessionCreateManyInput[] = [];
    let skipped = 0;
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      if (d.getDay() !== schedule.weekday) continue;
      if (taken.has(dayKey(d))) {
        skipped += 1;
        continue;
      }
      const startsAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
      const endsAt = new Date(startsAt.getTime() + schedule.durationMinutes * 60_000);
      rows.push({
        coachId: schedule.coachId,
        classScheduleId: id,
        groupName: schedule.venue ?? null,
        date: startOfDay(startsAt),
        startsAt,
        endsAt,
        topic: schedule.title,
        status: 'SCHEDULED'
      });
    }

    if (rows.length > 0) {
      await this.prisma.session.createMany({ data: rows });
    }

    return {
      created: rows.length,
      skipped,
      from: from.toISOString(),
      to: to.toISOString()
    };
  }

  private async load(id: string) {
    const schedule = await this.prisma.classSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('Class schedule not found');
    return schedule;
  }

  private assertDateRange(startISO?: string, endISO?: string) {
    if (!startISO || !endISO) return;
    if (new Date(endISO).getTime() < new Date(startISO).getTime()) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
  }

  private async validateRefs(coachId?: string, schoolGroupId?: string, termId?: string) {
    if (coachId) {
      const coach = await this.prisma.coachProfile.findUnique({ where: { id: coachId } });
      if (!coach) throw new NotFoundException('Coach not found');
    }
    if (schoolGroupId) {
      const group = await this.prisma.schoolGroup.findUnique({ where: { id: schoolGroupId } });
      if (!group) throw new NotFoundException('School group not found');
    }
    if (termId) {
      const term = await this.prisma.term.findUnique({ where: { id: termId } });
      if (!term) throw new NotFoundException('Term not found');
    }
  }
}
