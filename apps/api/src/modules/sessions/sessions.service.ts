import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCoachProfileOrThrow(currentUser: AuthenticatedUser) {
    const coachProfile = await this.prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId }
    });
    if (!coachProfile) {
      throw new ForbiddenException('Only coaches can perform this action');
    }
    return coachProfile;
  }

  async create(dto: CreateSessionDto, currentUser: AuthenticatedUser) {
    const coachProfile = await this.getCoachProfileOrThrow(currentUser);

    const links = await this.prisma.coachStudent.findMany({
      where: { coachId: coachProfile.id, studentId: { in: dto.presentStudentIds } }
    });
    const linkedIds = new Set(links.map((l) => l.studentId));
    const unauthorized = dto.presentStudentIds.filter((id) => !linkedIds.has(id));
    if (unauthorized.length > 0) {
      throw new ForbiddenException(
        `You are not the assigned coach for these students: ${unauthorized.join(', ')}`
      );
    }

    return this.prisma.session.create({
      data: {
        coachId: coachProfile.id,
        topic: dto.topic,
        date: new Date(dto.date),
        groupName: dto.groupName,
        notes: dto.notes,
        attendance: {
          create: dto.presentStudentIds.map((studentId) => ({ studentId, present: true }))
        }
      },
      include: { attendance: true }
    });
  }

  /// Same fix as StudentsService.findAll: `scope=own` forces the coach
  /// branch even for a user whose primary role is ADMIN, so Amwai's
  /// "Coach" view genuinely shows only his own logged sessions instead of
  /// every coach's sessions club-wide.
  async findAll(currentUser: AuthenticatedUser, scope?: string) {
    const wantsCoachView = scope === 'own' && currentUser.isCoach;

    if (currentUser.role === 'ADMIN' && !wantsCoachView) {
      return this.prisma.session.findMany({
        orderBy: { date: 'desc' },
        include: {
          coach: { select: { id: true, user: { select: { email: true } } } },
          attendance: true
        }
      });
    }

    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.getCoachProfileOrThrow(currentUser);
      return this.prisma.session.findMany({
        where: { coachId: coachProfile.id },
        orderBy: { date: 'desc' },
        include: { attendance: true }
      });
    }

    throw new ForbiddenException('You do not have permission to list sessions');
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        attendance: true,
        coach: { select: { id: true, user: { select: { email: true } } } }
      }
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (currentUser.role === 'ADMIN') return session;

    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.getCoachProfileOrThrow(currentUser);
      if (session.coachId === coachProfile.id) return session;
      throw new ForbiddenException('You did not log this session');
    }

    throw new ForbiddenException('You do not have permission to view this session');
  }
}
