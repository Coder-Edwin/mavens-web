import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RegisterTournamentDto } from './dto/register-tournament.dto';
import { RecordResultDto } from './dto/record-result.dto';

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTournamentDto) {
    return this.prisma.tournament.create({
      data: {
        name: dto.name,
        date: new Date(dto.date),
        venue: dto.venue,
        feeAmount: dto.feeAmount,
        capacity: dto.capacity,
        registrationDeadline: dto.registrationDeadline ? new Date(dto.registrationDeadline) : undefined
      }
    });
  }

  async findAll() {
    const tournaments = await this.prisma.tournament.findMany({
      orderBy: { date: 'asc' },
      include: { _count: { select: { registrations: true } } }
    });

    return tournaments.map(({ _count, ...tournament }) => ({
      ...tournament,
      registeredCount: _count.registrations,
      isFull: tournament.capacity != null && _count.registrations >= tournament.capacity
    }));
  }

  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          include: { student: { select: { firstName: true, lastName: true } } }
        }
      }
    });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    return tournament;
  }

  async register(tournamentId: string, dto: RegisterTournamentDto, currentUser: AuthenticatedUser) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const studentId = await this.resolveStudentId(dto, currentUser);

    // CHECK ORDER MATTERS: "already registered?" is the more specific,
    // more useful diagnosis, so it's checked BEFORE capacity/deadline.
    // Checking capacity first would (and did, in testing) produce a
    // misleading "tournament is full" message for a student who was
    // rejected for an entirely different reason — they'd already registered.
    const existingRegistration = await this.prisma.tournamentRegistration.findUnique({
      where: { tournamentId_studentId: { tournamentId, studentId } }
    });
    if (existingRegistration) {
      throw new ConflictException('This student is already registered for this tournament');
    }

    if (tournament.registrationDeadline && new Date() > tournament.registrationDeadline) {
      throw new BadRequestException('Registration for this tournament has closed');
    }

    const registrationCount = await this.prisma.tournamentRegistration.count({
      where: { tournamentId }
    });
    if (tournament.capacity != null && registrationCount >= tournament.capacity) {
      throw new BadRequestException('This tournament is full');
    }

    try {
      return await this.prisma.tournamentRegistration.create({
        data: { tournamentId, studentId }
      });
    } catch (err) {
      // Safety net for a race between two simultaneous requests for the
      // same student — the explicit check above handles the normal case,
      // this catches the rare concurrent one.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This student is already registered for this tournament');
      }
      throw err;
    }
  }

  private async resolveStudentId(dto: RegisterTournamentDto, currentUser: AuthenticatedUser): Promise<string> {
    if (currentUser.role === 'STUDENT') {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (!studentProfile) {
        throw new ForbiddenException('Student profile not found');
      }
      return studentProfile.id;
    }

    if (currentUser.role === 'PARENT') {
      if (!dto.studentId) {
        throw new BadRequestException('studentId is required when registering as a parent');
      }
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (!parentProfile) {
        throw new ForbiddenException('Parent profile not found');
      }
      const link = await this.prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: parentProfile.id, studentId: dto.studentId } }
      });
      if (!link) {
        throw new ForbiddenException('You are not linked to this student');
      }
      return dto.studentId;
    }

    if (currentUser.role === 'ADMIN') {
      if (!dto.studentId) {
        throw new BadRequestException('studentId is required');
      }
      return dto.studentId;
    }

    throw new ForbiddenException('You do not have permission to register for tournaments');
  }

  async recordResult(tournamentId: string, registrationId: string, dto: RecordResultDto) {
    const registration = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId }
    });
    if (!registration || registration.tournamentId !== tournamentId) {
      throw new NotFoundException('Registration not found for this tournament');
    }

    return this.prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: { result: dto.result }
    });
  }
}