import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RegisterTournamentDto } from './dto/register-tournament.dto';
import { RecordResultDto } from './dto/record-result.dto';
import {
  RecordPairingResultDto,
  UpdateRegistrationDto,
  UpdateTournamentDto
} from './dto/rounds.dto';
import { pairSwiss, pointsFor, type SwissPlayer } from './swiss';

interface PairingRow {
  whiteRegistrationId: string;
  blackRegistrationId: string | null;
  result: string | null;
}

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

  // ─────────────────────────────────────────────────────────────
  // Swiss rounds
  // ─────────────────────────────────────────────────────────────

  async updateTournament(id: string, dto: UpdateTournamentDto) {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tournament not found');
    return this.prisma.tournament.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        date: dto.date ? new Date(dto.date) : undefined,
        venue: dto.venue ?? undefined,
        feeAmount: dto.feeAmount ?? undefined,
        capacity: dto.capacity ?? undefined,
        totalRounds: dto.totalRounds ?? undefined,
        registrationDeadline: dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : undefined
      }
    });
  }

  async updateRegistration(
    tournamentId: string,
    registrationId: string,
    dto: UpdateRegistrationDto
  ) {
    const reg = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId }
    });
    if (!reg || reg.tournamentId !== tournamentId) {
      throw new NotFoundException('Registration not found for this tournament');
    }
    return this.prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        withdrawn: dto.withdrawn ?? undefined,
        seed: dto.seed ?? undefined
      }
    });
  }

  private readonly pairingInclude = {
    pairings: {
      orderBy: { board: 'asc' as const },
      include: {
        white: { select: { id: true, student: { select: { firstName: true, lastName: true } } } },
        black: { select: { id: true, student: { select: { firstName: true, lastName: true } } } }
      }
    }
  };

  async listRounds(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return this.prisma.tournamentRound.findMany({
      where: { tournamentId },
      orderBy: { number: 'asc' },
      include: this.pairingInclude
    });
  }

  async pairNextRound(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: { orderBy: { registeredAt: 'asc' } },
        rounds: { orderBy: { number: 'asc' }, include: { pairings: true } }
      }
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const last = tournament.rounds[tournament.rounds.length - 1];
    if (last && last.status !== 'COMPLETED') {
      throw new BadRequestException('Enter every result for the current round first');
    }
    if (tournament.totalRounds && tournament.rounds.length >= tournament.totalRounds) {
      throw new BadRequestException('All planned rounds have been paired');
    }

    const active = tournament.registrations.filter((r) => !r.withdrawn);
    if (active.length < 2) {
      throw new BadRequestException('Need at least two active players to pair a round');
    }

    const allPairings: PairingRow[] = tournament.rounds.flatMap((rd) => rd.pairings);
    const nextNumber = (last?.number ?? 0) + 1;

    const players: SwissPlayer[] = active.map((reg, idx) => {
      let whites = 0;
      let blacks = 0;
      let hadBye = false;
      let score = 0;
      const opponentIds = new Set<string>();
      for (const pr of allPairings) {
        const isWhite = pr.whiteRegistrationId === reg.id;
        const isBlack = pr.blackRegistrationId === reg.id;
        if (!isWhite && !isBlack) continue;
        score += pointsFor(reg.id, pr);
        if (pr.result === 'BYE') {
          hadBye = true;
          continue;
        }
        if (isWhite) {
          whites += 1;
          if (pr.blackRegistrationId) opponentIds.add(pr.blackRegistrationId);
        } else {
          blacks += 1;
          opponentIds.add(pr.whiteRegistrationId);
        }
      }
      return {
        id: reg.id,
        score,
        seed: reg.seed ?? 1000 + idx, // unseeded players sort after seeded, stably
        whites,
        blacks,
        opponentIds,
        hadBye
      };
    });

    const { pairings, byeId } = pairSwiss(players, { firstRound: nextNumber === 1 });

    const data = [
      ...pairings.map((p, i) => ({
        board: i + 1,
        whiteRegistrationId: p.whiteId,
        blackRegistrationId: p.blackId
      })),
      ...(byeId
        ? [
            {
              board: pairings.length + 1,
              whiteRegistrationId: byeId,
              blackRegistrationId: null,
              result: 'BYE' as const
            }
          ]
        : [])
    ];

    const round = await this.prisma.tournamentRound.create({
      data: { tournamentId, number: nextNumber, pairings: { create: data } },
      include: this.pairingInclude
    });

    // A round that is only a bye (can't happen with >=2 active) or otherwise
    // fully resolved is already complete.
    if (round.pairings.every((p) => p.result)) {
      return this.prisma.tournamentRound.update({
        where: { id: round.id },
        data: { status: 'COMPLETED' },
        include: this.pairingInclude
      });
    }
    return round;
  }

  async recordPairingResult(
    tournamentId: string,
    pairingId: string,
    dto: RecordPairingResultDto
  ) {
    const pairing = await this.prisma.tournamentPairing.findUnique({
      where: { id: pairingId },
      include: { round: true }
    });
    if (!pairing || pairing.round.tournamentId !== tournamentId) {
      throw new NotFoundException('Pairing not found for this tournament');
    }
    if (pairing.result === 'BYE') {
      throw new BadRequestException('The bye result is fixed');
    }

    await this.prisma.tournamentPairing.update({
      where: { id: pairingId },
      data: { result: dto.result }
    });

    const unresolved = await this.prisma.tournamentPairing.count({
      where: { roundId: pairing.roundId, result: null }
    });
    if (unresolved === 0) {
      await this.prisma.tournamentRound.update({
        where: { id: pairing.roundId },
        data: { status: 'COMPLETED' }
      });
    }

    return this.prisma.tournamentRound.findUnique({
      where: { id: pairing.roundId },
      include: this.pairingInclude
    });
  }

  async deleteRound(tournamentId: string, roundId: string) {
    const round = await this.prisma.tournamentRound.findUnique({ where: { id: roundId } });
    if (!round || round.tournamentId !== tournamentId) {
      throw new NotFoundException('Round not found for this tournament');
    }
    const max = await this.prisma.tournamentRound.aggregate({
      where: { tournamentId },
      _max: { number: true }
    });
    if (round.number !== max._max.number) {
      throw new BadRequestException('Only the most recent round can be removed');
    }
    await this.prisma.tournamentRound.delete({ where: { id: roundId } });
    return { id: roundId };
  }

  async standings(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          include: { student: { select: { firstName: true, lastName: true } } }
        },
        rounds: { include: { pairings: true } }
      }
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const allPairings: PairingRow[] = tournament.rounds.flatMap((r) => r.pairings);
    const scoreById = new Map<string, number>();
    for (const reg of tournament.registrations) {
      scoreById.set(
        reg.id,
        allPairings.reduce((s, pr) => s + pointsFor(reg.id, pr), 0)
      );
    }

    const rows = tournament.registrations.map((reg) => {
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let byes = 0;
      let games = 0;
      const opponentIds: string[] = [];
      for (const pr of allPairings) {
        const isWhite = pr.whiteRegistrationId === reg.id;
        const isBlack = pr.blackRegistrationId === reg.id;
        if ((!isWhite && !isBlack) || !pr.result) continue;
        if (pr.result === 'BYE') {
          byes += 1;
          continue;
        }
        games += 1;
        if (isWhite ? pr.blackRegistrationId : true) {
          opponentIds.push(isWhite ? pr.blackRegistrationId! : pr.whiteRegistrationId);
        }
        const pts = pointsFor(reg.id, pr);
        if (pts === 1) wins += 1;
        else if (pts === 0.5) draws += 1;
        else losses += 1;
      }
      const buchholz = opponentIds.reduce((s, oid) => s + (scoreById.get(oid) ?? 0), 0);
      return {
        registrationId: reg.id,
        name: `${reg.student.firstName} ${reg.student.lastName}`,
        withdrawn: reg.withdrawn,
        score: scoreById.get(reg.id) ?? 0,
        buchholz,
        games,
        wins,
        draws,
        losses,
        byes,
        seed: reg.seed ?? null
      };
    });

    rows.sort(
      (a, b) =>
        Number(a.withdrawn) - Number(b.withdrawn) ||
        b.score - a.score ||
        b.buchholz - a.buchholz ||
        (a.seed ?? 1e9) - (b.seed ?? 1e9) ||
        a.name.localeCompare(b.name)
    );

    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  }
}