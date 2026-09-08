import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CancelPlacementDto,
  CompletePlacementDto,
  PLACEMENT_STATUSES,
  SchedulePlacementDto,
  UpdatePlacementDto,
  type PlacementStatus
} from './dto/placement.dto';

// A placement assessment sits a student down with a coach so their level can be
// set. Completing one is the moment a student's level becomes authoritative:
// it stamps StudentProfile.level and, if the assessment was tied to an
// enrollment still awaiting placement, activates that enrollment.
export const REVIEW_INTERVAL_MONTHS = 6;

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

interface FindAllFilters {
  status?: string;
  studentId?: string;
  dueBefore?: string;
}

@Injectable()
export class PlacementsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    student: { select: { id: true, firstName: true, lastName: true, level: true } },
    assessorCoach: { select: { id: true } },
    enrollment: { select: { id: true, status: true, deliveryType: true, level: true } }
  } satisfies Prisma.PlacementAssessmentInclude;

  async schedule(dto: SchedulePlacementDto) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    if (dto.enrollmentId) {
      const enrollment = await this.prisma.enrollment.findUnique({ where: { id: dto.enrollmentId } });
      if (!enrollment) throw new NotFoundException('Enrollment not found');
      if (enrollment.studentId !== dto.studentId) {
        throw new BadRequestException('That enrollment belongs to a different student');
      }
    }

    if (dto.assessorCoachId) await this.assertCoachExists(dto.assessorCoachId);

    return this.prisma.placementAssessment.create({
      data: {
        studentId: dto.studentId,
        enrollmentId: dto.enrollmentId ?? null,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        assessorCoachId: dto.assessorCoachId ?? null,
        notes: dto.notes?.trim() || null
      },
      include: this.include
    });
  }

  findAll(filters: FindAllFilters = {}) {
    const where: Prisma.PlacementAssessmentWhereInput = {};
    if (filters.status && (PLACEMENT_STATUSES as readonly string[]).includes(filters.status)) {
      where.status = filters.status as PlacementStatus;
    }
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.dueBefore) {
      where.nextReviewDue = { lte: new Date(filters.dueBefore) };
    }
    return this.prisma.placementAssessment.findMany({
      where,
      orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }],
      include: this.include
    });
  }

  async findOne(id: string) {
    const assessment = await this.prisma.placementAssessment.findUnique({
      where: { id },
      include: this.include
    });
    if (!assessment) throw new NotFoundException('Placement assessment not found');
    return assessment;
  }

  async update(id: string, dto: UpdatePlacementDto) {
    const assessment = await this.load(id);
    if (assessment.status !== 'SCHEDULED') {
      throw new BadRequestException('Only a scheduled assessment can be rescheduled');
    }
    if (dto.assessorCoachId) await this.assertCoachExists(dto.assessorCoachId);

    return this.prisma.placementAssessment.update({
      where: { id },
      data: {
        scheduledFor:
          dto.scheduledFor !== undefined ? new Date(dto.scheduledFor) : undefined,
        assessorCoachId: dto.assessorCoachId ?? undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      },
      include: this.include
    });
  }

  async complete(id: string, dto: CompletePlacementDto, byUserId?: string) {
    const assessment = await this.load(id);
    if (assessment.status !== 'SCHEDULED') {
      throw new BadRequestException('This assessment is not open');
    }

    const completedAt = new Date();
    const nextReviewDue = dto.nextReviewDue
      ? new Date(dto.nextReviewDue)
      : addMonths(completedAt, REVIEW_INTERVAL_MONTHS);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.placementAssessment.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          resultLevel: dto.resultLevel,
          completedAt,
          nextReviewDue,
          notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
        },
        include: this.include
      });

      await tx.studentProfile.update({
        where: { id: assessment.studentId },
        data: { level: dto.resultLevel }
      });

      if (assessment.enrollmentId) {
        const enrollment = await tx.enrollment.findUnique({
          where: { id: assessment.enrollmentId }
        });
        if (enrollment && (enrollment.status === 'PENDING_PLACEMENT' || enrollment.status === 'WAITLISTED')) {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: {
              status: 'ACTIVE',
              level: dto.resultLevel,
              waitlistNote: null,
              events: {
                create: {
                  type: 'PLACED',
                  fromValue: enrollment.level ?? null,
                  toValue: dto.resultLevel,
                  byUserId: byUserId ?? null,
                  note: `Placed from assessment ${id}`
                }
              }
            }
          });
        } else if (enrollment && enrollment.level !== dto.resultLevel) {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: {
              level: dto.resultLevel,
              events: {
                create: {
                  type: 'LEVEL_CHANGE',
                  fromValue: enrollment.level ?? null,
                  toValue: dto.resultLevel,
                  byUserId: byUserId ?? null,
                  note: `Re-assessment ${id}`
                }
              }
            }
          });
        }
      }

      return updated;
    });
  }

  async cancel(id: string, dto: CancelPlacementDto) {
    const assessment = await this.load(id);
    if (assessment.status !== 'SCHEDULED') {
      throw new BadRequestException('Only a scheduled assessment can be cancelled');
    }
    return this.prisma.placementAssessment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      },
      include: this.include
    });
  }

  async remove(id: string) {
    const assessment = await this.load(id);
    if (assessment.status !== 'SCHEDULED') {
      throw new BadRequestException('Only a scheduled assessment can be deleted — cancel it instead.');
    }
    await this.prisma.placementAssessment.delete({ where: { id } });
    return { id };
  }

  private async load(id: string) {
    const assessment = await this.prisma.placementAssessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Placement assessment not found');
    return assessment;
  }

  private async assertCoachExists(coachId: string) {
    const coach = await this.prisma.coachProfile.findUnique({ where: { id: coachId } });
    if (!coach) throw new NotFoundException('Assessor coach not found');
  }
}
