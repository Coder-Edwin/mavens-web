import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AwardBadgeDto, CreateBadgeDto, UpdateBadgeDto } from './dto/badge.dto';

/// Badges are a manually-curated catalog (Badge.criteria is free text an
/// admin/coach reads and judges by hand — there's no automatic-award
/// detection here, deliberately: what counts as "earning" one is a coaching
/// call, not a rule the system can enforce).
@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Catalog (admin-managed) ----------

  createBadge(dto: CreateBadgeDto) {
    return this.prisma.badge.create({
      data: { name: dto.name.trim(), icon: dto.icon.trim(), criteria: dto.criteria?.trim() || null }
    });
  }

  listBadges() {
    return this.prisma.badge.findMany({ orderBy: { name: 'asc' } });
  }

  async updateBadge(id: string, dto: UpdateBadgeDto) {
    const badge = await this.prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundException('Badge not found');
    return this.prisma.badge.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        icon: dto.icon?.trim() ?? undefined,
        criteria: dto.criteria !== undefined ? dto.criteria.trim() || null : undefined
      }
    });
  }

  async removeBadge(id: string) {
    const badge = await this.prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundException('Badge not found');
    const awarded = await this.prisma.studentBadge.count({ where: { badgeId: id } });
    if (awarded > 0) {
      throw new BadRequestException('This badge has already been awarded to a student and cannot be deleted');
    }
    await this.prisma.badge.delete({ where: { id } });
    return { id };
  }

  // ---------- Awarding ----------

  async award(dto: AwardBadgeDto, currentUser: AuthenticatedUser) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    const badge = await this.prisma.badge.findUnique({ where: { id: dto.badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');
    await this.assertCanAccessStudent(dto.studentId, currentUser, true);

    try {
      return await this.prisma.studentBadge.create({
        data: { studentId: dto.studentId, badgeId: dto.badgeId },
        include: { badge: true }
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('This student already has this badge');
      }
      throw err;
    }
  }

  async revoke(studentId: string, badgeId: string, currentUser: AuthenticatedUser) {
    await this.assertCanAccessStudent(studentId, currentUser, true);
    const existing = await this.prisma.studentBadge.findUnique({
      where: { studentId_badgeId: { studentId, badgeId } }
    });
    if (!existing) throw new NotFoundException('This student does not have this badge');
    await this.prisma.studentBadge.delete({ where: { studentId_badgeId: { studentId, badgeId } } });
    return { studentId, badgeId };
  }

  // ---------- Viewing a student's earned badges ----------

  async listForStudent(studentId: string, currentUser: AuthenticatedUser) {
    await this.assertCanAccessStudent(studentId, currentUser, false);
    return this.prisma.studentBadge.findMany({
      where: { studentId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' }
    });
  }

  /// A student's own badges, with no id needed from the client.
  async myBadges(currentUser: AuthenticatedUser) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId: currentUser.userId } });
    if (!student) return [];
    return this.prisma.studentBadge.findMany({
      where: { studentId: student.id },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' }
    });
  }

  private isUniqueViolation(err: unknown): boolean {
    return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002';
  }

  /// Admin: always. Coach: only an assigned student, read or write. Parent:
  /// only a linked child, read-only. Student: only themselves, read-only.
  private async assertCanAccessStudent(studentId: string, currentUser: AuthenticatedUser, forWrite: boolean) {
    if (currentUser.role === 'ADMIN') return;

    if (currentUser.role === 'COACH') {
      const coach = await this.prisma.coachProfile.findUnique({ where: { userId: currentUser.userId } });
      const linked =
        coach &&
        (await this.prisma.coachStudent.findUnique({
          where: { coachId_studentId: { coachId: coach.id, studentId } }
        }));
      if (linked) return;
      throw new ForbiddenException("You are not this student's coach");
    }

    if (forWrite) throw new ForbiddenException('Only a coach or admin can do this');

    if (currentUser.role === 'STUDENT') {
      const student = await this.prisma.studentProfile.findUnique({ where: { userId: currentUser.userId } });
      if (student && student.id === studentId) return;
      throw new ForbiddenException('You can only view your own badges');
    }

    if (currentUser.role === 'PARENT') {
      const parent = await this.prisma.parentProfile.findUnique({ where: { userId: currentUser.userId } });
      const linked =
        parent &&
        (await this.prisma.parentStudent.findUnique({
          where: { parentId_studentId: { parentId: parent.id, studentId } }
        }));
      if (linked) return;
      throw new ForbiddenException('You are not linked to this student');
    }

    throw new ForbiddenException('You do not have permission to view these badges');
  }
}
