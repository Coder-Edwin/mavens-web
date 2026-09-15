import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateLessonPlanDto, UpdateLessonPlanDto } from './dto/lesson-plan.dto';

/// A coach's reusable library of lesson plans — title/objectives/material,
/// optionally linked to a Session (Session.lessonPlanId) when it's actually
/// taught. Each coach sees only their own; an admin has full oversight.
@Injectable()
export class LessonPlansService {
  constructor(private readonly prisma: PrismaService) {}

  private async coachIdFor(user: AuthenticatedUser): Promise<string> {
    const coach = await this.prisma.coachProfile.findUnique({ where: { userId: user.userId } });
    if (!coach) throw new ForbiddenException('Coach profile not found');
    return coach.id;
  }

  async create(dto: CreateLessonPlanDto, user: AuthenticatedUser) {
    const coachId = await this.coachIdFor(user);
    return this.prisma.lessonPlan.create({
      data: {
        coachId,
        title: dto.title.trim(),
        objectives: dto.objectives?.trim() || null,
        materialUrl: dto.materialUrl?.trim() || null,
        difficulty: dto.difficulty?.trim() || null
      }
    });
  }

  /// A plain admin (no CoachProfile) gets the whole club's library for
  /// oversight; anyone with a CoachProfile — including an admin-who-is-also-
  /// a-coach — sees only their own plans, matching the scope=own pattern
  /// used elsewhere for Amwai's dual role.
  async findAll(user: AuthenticatedUser) {
    if (user.role === 'ADMIN' && !user.isCoach) {
      return this.prisma.lessonPlan.findMany({
        orderBy: { createdAt: 'desc' },
        include: { coach: { select: { firstName: true, lastName: true } } }
      });
    }
    const coachId = await this.coachIdFor(user);
    return this.prisma.lessonPlan.findMany({ where: { coachId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const plan = await this.load(id);
    await this.assertOwnership(plan, user);
    return plan;
  }

  async update(id: string, dto: UpdateLessonPlanDto, user: AuthenticatedUser) {
    const plan = await this.load(id);
    await this.assertOwnership(plan, user);
    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        objectives: dto.objectives !== undefined ? dto.objectives.trim() || null : undefined,
        materialUrl: dto.materialUrl !== undefined ? dto.materialUrl.trim() || null : undefined,
        difficulty: dto.difficulty !== undefined ? dto.difficulty.trim() || null : undefined
      }
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const plan = await this.load(id);
    await this.assertOwnership(plan, user);
    const inUse = await this.prisma.session.count({ where: { lessonPlanId: id } });
    if (inUse > 0) {
      throw new BadRequestException('This lesson plan is attached to a session and cannot be deleted');
    }
    await this.prisma.lessonPlan.delete({ where: { id } });
    return { id };
  }

  private async load(id: string) {
    const plan = await this.prisma.lessonPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Lesson plan not found');
    return plan;
  }

  private async assertOwnership(plan: { coachId: string }, user: AuthenticatedUser) {
    if (user.role === 'ADMIN') return; // full oversight, coach or not
    const coachId = await this.coachIdFor(user);
    if (plan.coachId !== coachId) throw new ForbiddenException('This is not your lesson plan');
  }
}
