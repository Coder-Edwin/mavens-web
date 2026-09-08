import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';
import { CancelSessionDto, CompleteSessionDto } from './dto/session-lifecycle.dto';

interface SessionFilters {
  scope?: string;
  from?: string;
  to?: string;
  status?: string;
}

const SESSION_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'LOGGED'];

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly scheduleInclude = {
    classSchedule: { select: { id: true, title: true, deliveryType: true, venue: true } }
  } satisfies Prisma.SessionInclude;

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
  /// "Coach" view genuinely shows only his own sessions instead of every
  /// coach's sessions club-wide. `from`/`to` (inclusive day bounds) and
  /// `status` drive the calendar/agenda views.
  async findAll(currentUser: AuthenticatedUser, filters: SessionFilters = {}) {
    const wantsCoachView = filters.scope === 'own' && currentUser.isCoach;

    const where: Prisma.SessionWhereInput = {};
    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) {
        // treat `to` as an inclusive day: bump to the next midnight
        const end = new Date(filters.to);
        end.setDate(end.getDate() + 1);
        where.date.lt = end;
      }
    }
    if (filters.status && SESSION_STATUSES.includes(filters.status)) {
      where.status = filters.status as Prisma.SessionWhereInput['status'];
    }

    if (currentUser.role === 'ADMIN' && !wantsCoachView) {
      return this.prisma.session.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          coach: { select: { id: true, user: { select: { email: true } } } },
          attendance: true,
          ...this.scheduleInclude
        }
      });
    }

    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.getCoachProfileOrThrow(currentUser);
      return this.prisma.session.findMany({
        where: { ...where, coachId: coachProfile.id },
        orderBy: { date: 'desc' },
        include: { attendance: true, ...this.scheduleInclude }
      });
    }

    throw new ForbiddenException('You do not have permission to list sessions');
  }

  /// Mark a session run: fill in the topic/notes if given and replace the
  /// attendance list. Works for a SCHEDULED session (the normal path) or to
  /// re-save attendance on an already COMPLETED one.
  async complete(id: string, dto: CompleteSessionDto, currentUser: AuthenticatedUser) {
    const session = await this.getOwnedSessionOrThrow(id, currentUser);
    if (session.status === 'CANCELLED') {
      throw new BadRequestException('This session was cancelled');
    }

    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: dto.presentStudentIds } },
      select: { id: true }
    });
    const known = new Set(students.map((s) => s.id));
    const unknown = dto.presentStudentIds.filter((sid) => !known.has(sid));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown student ids: ${unknown.join(', ')}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.sessionAttendance.deleteMany({ where: { sessionId: id } });
      await tx.session.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          topic: dto.topic?.trim() || session.topic,
          notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
          attendance: {
            create: dto.presentStudentIds.map((studentId) => ({ studentId, present: true }))
          }
        }
      });
      return tx.session.findUnique({
        where: { id },
        include: { attendance: true, ...this.scheduleInclude }
      });
    });
  }

  async cancel(id: string, dto: CancelSessionDto, currentUser: AuthenticatedUser) {
    const session = await this.getOwnedSessionOrThrow(id, currentUser);
    if (session.status === 'COMPLETED') {
      throw new BadRequestException('This session was already completed');
    }
    return this.prisma.session.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      },
      include: { attendance: true, ...this.scheduleInclude }
    });
  }

  private async getOwnedSessionOrThrow(id: string, currentUser: AuthenticatedUser) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    if (currentUser.role === 'ADMIN') return session;
    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.getCoachProfileOrThrow(currentUser);
      if (session.coachId === coachProfile.id) return session;
      throw new ForbiddenException('This session belongs to another coach');
    }
    throw new ForbiddenException('You do not have permission to change this session');
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
