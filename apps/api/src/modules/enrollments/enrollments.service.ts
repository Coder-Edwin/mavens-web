import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateEnrollmentDto, ENROLLMENT_STATUSES, type EnrollmentStatus } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import {
  PauseEnrollmentDto,
  PlaceEnrollmentDto,
  ResumeEnrollmentDto,
  WaitlistEnrollmentDto,
  WithdrawEnrollmentDto
} from './dto/transition-enrollment.dto';

const DELIVERY_TYPES = ['HOME', 'CENTER', 'SCHOOL_GROUP'] as const;

interface FindAllFilters {
  status?: string;
  deliveryType?: string;
  studentId?: string;
  schoolGroupId?: string;
}

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly listInclude = {
    student: { select: { id: true, firstName: true, lastName: true } },
    schoolGroup: { select: { id: true, institutionName: true } },
    assignedCoach: { select: { id: true } }
  } satisfies Prisma.EnrollmentInclude;

  private readonly detailInclude = {
    student: { select: { id: true, firstName: true, lastName: true } },
    schoolGroup: { select: { id: true, institutionName: true } },
    assignedCoach: { select: { id: true } },
    events: { orderBy: { at: 'desc' } },
    placements: { orderBy: { createdAt: 'desc' } }
  } satisfies Prisma.EnrollmentInclude;

  async create(dto: CreateEnrollmentDto, byUserId?: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    let schoolGroupId: string | null = null;
    let clientType: 'INDIVIDUAL' | 'INSTITUTION' = 'INDIVIDUAL';
    if (dto.deliveryType === 'SCHOOL_GROUP') {
      if (!dto.schoolGroupId) {
        throw new BadRequestException('schoolGroupId is required for a SCHOOL_GROUP enrollment');
      }
      const group = await this.prisma.schoolGroup.findUnique({ where: { id: dto.schoolGroupId } });
      if (!group) throw new NotFoundException('School group not found');
      schoolGroupId = group.id;
      clientType = 'INSTITUTION';
    }

    if (dto.assignedCoachId) {
      await this.assertCoachExists(dto.assignedCoachId);
    }

    const waitlisted = dto.waitlisted === true;
    const placedNow = !waitlisted && !!dto.level;
    const status: EnrollmentStatus = waitlisted
      ? 'WAITLISTED'
      : placedNow
        ? 'ACTIVE'
        : 'PENDING_PLACEMENT';
    const note = dto.note?.trim() || null;

    const events: Prisma.EnrollmentEventCreateWithoutEnrollmentInput[] = [
      { type: 'CREATED', byUserId: byUserId ?? null, note }
    ];
    if (waitlisted) events.push({ type: 'WAITLISTED', byUserId: byUserId ?? null });
    if (placedNow) {
      events.push({ type: 'PLACED', toValue: dto.level, byUserId: byUserId ?? null });
    }

    return this.prisma.enrollment.create({
      data: {
        studentId: student.id,
        deliveryType: dto.deliveryType,
        schoolGroupId,
        clientType,
        level: dto.level ?? null,
        assignedCoachId: dto.assignedCoachId ?? null,
        status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        waitlistNote: waitlisted ? note : null,
        events: { create: events }
      },
      include: this.detailInclude
    });
  }

  findAll(filters: FindAllFilters = {}) {
    const where: Prisma.EnrollmentWhereInput = {};
    if (filters.status && (ENROLLMENT_STATUSES as readonly string[]).includes(filters.status)) {
      where.status = filters.status as EnrollmentStatus;
    }
    if (filters.deliveryType && (DELIVERY_TYPES as readonly string[]).includes(filters.deliveryType)) {
      where.deliveryType = filters.deliveryType as (typeof DELIVERY_TYPES)[number];
    }
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.schoolGroupId) where.schoolGroupId = filters.schoolGroupId;

    return this.prisma.enrollment.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: this.listInclude
    });
  }

  async findOne(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: this.detailInclude
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  /// Read-only view for the portals: a student sees their own enrollments, a
  /// parent sees every linked child's, a coach sees the ones assigned to
  /// them. Anyone else (a pure admin) gets an empty list — they use /enrollments.
  async findForUser(user: AuthenticatedUser) {
    if (user.role === 'STUDENT') {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true }
      });
      if (!profile) return [];
      return this.listForWhere({ studentId: profile.id });
    }

    if (user.role === 'PARENT') {
      const profile = await this.prisma.parentProfile.findUnique({
        where: { userId: user.userId },
        select: { studentLinks: { select: { studentId: true } } }
      });
      if (!profile || profile.studentLinks.length === 0) return [];
      return this.listForWhere({
        studentId: { in: profile.studentLinks.map((l) => l.studentId) }
      });
    }

    if (user.role === 'COACH' || user.isCoach) {
      const profile = await this.prisma.coachProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true }
      });
      if (!profile) return [];
      return this.listForWhere({ assignedCoachId: profile.id });
    }

    return [];
  }

  private listForWhere(where: Prisma.EnrollmentWhereInput) {
    return this.prisma.enrollment.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: this.detailInclude
    });
  }

  async update(id: string, dto: UpdateEnrollmentDto, byUserId?: string) {
    const enrollment = await this.load(id);
    const data: Prisma.EnrollmentUpdateInput = {};
    const events: Prisma.EnrollmentEventCreateWithoutEnrollmentInput[] = [];
    const note = dto.note?.trim() || null;

    const nextDelivery = dto.deliveryType ?? enrollment.deliveryType;
    const deliveryChanged = dto.deliveryType !== undefined && dto.deliveryType !== enrollment.deliveryType;
    const groupChanged =
      dto.schoolGroupId !== undefined && dto.schoolGroupId !== enrollment.schoolGroupId;

    if (deliveryChanged || groupChanged) {
      if (nextDelivery === 'SCHOOL_GROUP') {
        const groupId = dto.schoolGroupId ?? enrollment.schoolGroupId;
        if (!groupId) {
          throw new BadRequestException('schoolGroupId is required for a SCHOOL_GROUP enrollment');
        }
        const group = await this.prisma.schoolGroup.findUnique({ where: { id: groupId } });
        if (!group) throw new NotFoundException('School group not found');
        data.schoolGroup = { connect: { id: groupId } };
        data.clientType = 'INSTITUTION';
      } else {
        data.schoolGroup = { disconnect: true };
        data.clientType = 'INDIVIDUAL';
      }
      if (deliveryChanged) data.deliveryType = dto.deliveryType;
      events.push({
        type: 'DELIVERY_CHANGE',
        fromValue: enrollment.deliveryType,
        toValue: nextDelivery,
        byUserId: byUserId ?? null,
        note
      });
    }

    if (dto.level !== undefined && dto.level !== enrollment.level) {
      data.level = dto.level;
      events.push({
        type: 'LEVEL_CHANGE',
        fromValue: enrollment.level ?? null,
        toValue: dto.level,
        byUserId: byUserId ?? null,
        note
      });
    }

    if (dto.assignedCoachId !== undefined && dto.assignedCoachId !== enrollment.assignedCoachId) {
      await this.assertCoachExists(dto.assignedCoachId);
      data.assignedCoach = { connect: { id: dto.assignedCoachId } };
      events.push({
        type: 'COACH_CHANGE',
        fromValue: enrollment.assignedCoachId ?? null,
        toValue: dto.assignedCoachId,
        byUserId: byUserId ?? null,
        note
      });
    }

    if (events.length === 0) return this.findOne(id);

    return this.prisma.enrollment.update({
      where: { id },
      data: { ...data, events: { create: events } },
      include: this.detailInclude
    });
  }

  place(id: string, dto: PlaceEnrollmentDto, byUserId?: string) {
    return this.runTransition(id, {
      action: 'place',
      allowedFrom: ['PENDING_PLACEMENT', 'WAITLISTED'],
      byUserId,
      note: dto.note,
      beforeData: dto.assignedCoachId ? () => this.assertCoachExists(dto.assignedCoachId!) : undefined,
      data: {
        status: 'ACTIVE',
        level: dto.level,
        waitlistNote: null,
        ...(dto.assignedCoachId ? { assignedCoach: { connect: { id: dto.assignedCoachId } } } : {})
      },
      event: (enrollment) => ({
        type: 'PLACED',
        fromValue: enrollment.level ?? null,
        toValue: dto.level
      })
    });
  }

  pause(id: string, dto: PauseEnrollmentDto, byUserId?: string) {
    return this.runTransition(id, {
      action: 'pause',
      allowedFrom: ['ACTIVE'],
      byUserId,
      note: dto.note,
      data: {
        status: 'PAUSED',
        pausedFrom: dto.pausedFrom ? new Date(dto.pausedFrom) : new Date(),
        pausedTo: dto.pausedTo ? new Date(dto.pausedTo) : null
      },
      event: () => ({ type: 'PAUSED' })
    });
  }

  resume(id: string, dto: ResumeEnrollmentDto, byUserId?: string) {
    return this.runTransition(id, {
      action: 'resume',
      allowedFrom: ['PAUSED'],
      byUserId,
      note: dto.note,
      data: { status: 'ACTIVE', pausedFrom: null, pausedTo: null },
      event: () => ({ type: 'RESUMED' })
    });
  }

  withdraw(id: string, dto: WithdrawEnrollmentDto, byUserId?: string) {
    return this.runTransition(id, {
      action: 'withdraw',
      allowedFrom: ['PENDING_PLACEMENT', 'WAITLISTED', 'ACTIVE', 'PAUSED'],
      byUserId,
      note: dto.note,
      data: {
        status: 'WITHDRAWN',
        endDate: dto.endDate ? new Date(dto.endDate) : new Date()
      },
      event: () => ({ type: 'WITHDRAWN' })
    });
  }

  waitlist(id: string, dto: WaitlistEnrollmentDto, byUserId?: string) {
    const note = dto.note?.trim() || null;
    return this.runTransition(id, {
      action: 'waitlist',
      allowedFrom: ['PENDING_PLACEMENT'],
      byUserId,
      note: dto.note,
      data: { status: 'WAITLISTED', waitlistNote: note },
      event: () => ({ type: 'WAITLISTED' })
    });
  }

  async remove(id: string) {
    const enrollment = await this.load(id);
    if (enrollment.status !== 'PENDING_PLACEMENT' && enrollment.status !== 'WAITLISTED') {
      throw new BadRequestException(
        'Only an enrollment still awaiting placement can be deleted — withdraw it instead.'
      );
    }
    await this.prisma.enrollment.delete({ where: { id } });
    return { id };
  }

  private async load(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id } });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  private async assertCoachExists(coachId: string) {
    const coach = await this.prisma.coachProfile.findUnique({ where: { id: coachId } });
    if (!coach) throw new NotFoundException('Assigned coach not found');
  }

  private async runTransition(
    id: string,
    opts: {
      action: string;
      allowedFrom: EnrollmentStatus[];
      byUserId?: string;
      note?: string;
      data: Prisma.EnrollmentUpdateInput;
      event: (enrollment: Awaited<ReturnType<EnrollmentsService['load']>>) =>
        Omit<Prisma.EnrollmentEventCreateWithoutEnrollmentInput, 'byUserId' | 'note'>;
      beforeData?: () => Promise<void>;
    }
  ) {
    const enrollment = await this.load(id);
    if (!opts.allowedFrom.includes(enrollment.status as EnrollmentStatus)) {
      throw new BadRequestException(
        `Cannot ${opts.action} an enrollment that is ${enrollment.status}`
      );
    }
    if (opts.beforeData) await opts.beforeData();

    return this.prisma.enrollment.update({
      where: { id },
      data: {
        ...opts.data,
        events: {
          create: {
            ...opts.event(enrollment),
            byUserId: opts.byUserId ?? null,
            note: opts.note?.trim() || null
          }
        }
      },
      include: this.detailInclude
    });
  }
}
