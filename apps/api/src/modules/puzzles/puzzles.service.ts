import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreatePuzzleSetDto } from './dto/create-puzzle-set.dto';
import { CreatePuzzleAssignmentDto } from './dto/create-puzzle-assignment.dto';
import { GradePuzzleDto } from './dto/grade-puzzle.dto';

@Injectable()
export class PuzzlesService {
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

  private async getStudentProfileOrThrow(currentUser: AuthenticatedUser) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId: currentUser.userId }
    });
    if (!studentProfile) {
      throw new ForbiddenException('Only students can perform this action');
    }
    return studentProfile;
  }

  // ---------- Puzzle sets (the reusable content a coach builds once) ----------

  async createSet(dto: CreatePuzzleSetDto, currentUser: AuthenticatedUser) {
    const coachProfile = await this.getCoachProfileOrThrow(currentUser);
    return this.prisma.puzzleSet.create({
      data: {
        coachId: coachProfile.id,
        title: dto.title,
        description: dto.description,
        difficulty: dto.difficulty
      }
    });
  }

  async findAllSets(currentUser: AuthenticatedUser) {
    if (currentUser.role === 'ADMIN') {
      return this.prisma.puzzleSet.findMany({ orderBy: { createdAt: 'desc' } });
    }
    const coachProfile = await this.getCoachProfileOrThrow(currentUser);
    return this.prisma.puzzleSet.findMany({
      where: { coachId: coachProfile.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ---------- Assignments (a puzzle set handed to a specific student) ----------

  async assign(dto: CreatePuzzleAssignmentDto, currentUser: AuthenticatedUser) {
    const coachProfile = await this.getCoachProfileOrThrow(currentUser);

    const puzzleSet = await this.prisma.puzzleSet.findUnique({ where: { id: dto.puzzleSetId } });
    if (!puzzleSet) {
      throw new NotFoundException('Puzzle set not found');
    }
    if (puzzleSet.coachId !== coachProfile.id) {
      throw new ForbiddenException('You can only assign puzzle sets you created');
    }

    // Same write-time ownership check as SessionsService: verify every
    // student ID actually belongs to this coach before creating anything.
    const links = await this.prisma.coachStudent.findMany({
      where: { coachId: coachProfile.id, studentId: { in: dto.studentIds } }
    });
    const linkedIds = new Set(links.map((l) => l.studentId));
    const unauthorized = dto.studentIds.filter((id) => !linkedIds.has(id));
    if (unauthorized.length > 0) {
      throw new ForbiddenException(
        `You are not the assigned coach for these students: ${unauthorized.join(', ')}`
      );
    }

    // One PuzzleAssignment row per student, even for a group assignment —
    // this is what makes "6 of 8 submitted" queries trivial later.
    return this.prisma.$transaction(
      dto.studentIds.map((studentId) =>
        this.prisma.puzzleAssignment.create({
          data: {
            puzzleSetId: dto.puzzleSetId,
            studentId,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined
          }
        })
      )
    );
  }

  async findAllAssignments(currentUser: AuthenticatedUser) {
    if (currentUser.role === 'ADMIN') {
      return this.prisma.puzzleAssignment.findMany({
        include: {
          puzzleSet: true,
          submission: true,
          student: { select: { firstName: true, lastName: true } }
        },
        orderBy: { assignedAt: 'desc' }
      });
    }

    if (currentUser.role === 'STUDENT') {
      const studentProfile = await this.getStudentProfileOrThrow(currentUser);
      return this.prisma.puzzleAssignment.findMany({
        where: { studentId: studentProfile.id },
        include: { puzzleSet: true, submission: true },
        orderBy: { assignedAt: 'desc' }
      });
    }

    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.getCoachProfileOrThrow(currentUser);
      return this.prisma.puzzleAssignment.findMany({
        where: { puzzleSet: { coachId: coachProfile.id } },
        include: {
          puzzleSet: true,
          submission: true,
          student: { select: { firstName: true, lastName: true } }
        },
        orderBy: { assignedAt: 'desc' }
      });
    }

    throw new ForbiddenException('You do not have permission to list puzzle assignments');
  }

  async findOneAssignment(id: string, currentUser: AuthenticatedUser) {
    const assignment = await this.prisma.puzzleAssignment.findUnique({
      where: { id },
      include: { puzzleSet: true, submission: true, student: true }
    });
    if (!assignment) {
      throw new NotFoundException('Puzzle assignment not found');
    }

    if (currentUser.role === 'ADMIN') return assignment;

    if (currentUser.role === 'STUDENT') {
      const studentProfile = await this.getStudentProfileOrThrow(currentUser);
      if (assignment.studentId === studentProfile.id) return assignment;
      throw new ForbiddenException('This puzzle was not assigned to you');
    }

    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.getCoachProfileOrThrow(currentUser);
      if (assignment.puzzleSet.coachId === coachProfile.id) return assignment;
      throw new ForbiddenException('You did not assign this puzzle');
    }

    throw new ForbiddenException('You do not have permission to view this assignment');
  }

  // ---------- Submit (student) & grade (coach) — the two-actor lifecycle ----------

  async submit(id: string, currentUser: AuthenticatedUser) {
    const studentProfile = await this.getStudentProfileOrThrow(currentUser);

    const assignment = await this.prisma.puzzleAssignment.findUnique({
      where: { id },
      include: { submission: true }
    });
    if (!assignment) {
      throw new NotFoundException('Puzzle assignment not found');
    }
    if (assignment.studentId !== studentProfile.id) {
      throw new ForbiddenException('This puzzle was not assigned to you');
    }
    if (assignment.submission) {
      throw new ConflictException('This puzzle has already been submitted');
    }

    const [, submission] = await this.prisma.$transaction([
      this.prisma.puzzleAssignment.update({
        where: { id },
        data: { status: 'SUBMITTED' }
      }),
      this.prisma.puzzleSubmission.create({
        data: { assignmentId: id }
      })
    ]);

    return submission;
  }

  async grade(id: string, dto: GradePuzzleDto, currentUser: AuthenticatedUser) {
    const coachProfile = await this.getCoachProfileOrThrow(currentUser);

    const assignment = await this.prisma.puzzleAssignment.findUnique({
      where: { id },
      include: { puzzleSet: true, submission: true }
    });
    if (!assignment) {
      throw new NotFoundException('Puzzle assignment not found');
    }
    if (assignment.puzzleSet.coachId !== coachProfile.id) {
      throw new ForbiddenException('You did not assign this puzzle');
    }
    if (!assignment.submission) {
      throw new ConflictException('This student has not submitted this puzzle yet');
    }

    const [, submission] = await this.prisma.$transaction([
      this.prisma.puzzleAssignment.update({
        where: { id },
        data: { status: 'GRADED' }
      }),
      this.prisma.puzzleSubmission.update({
        where: { assignmentId: id },
        data: {
          score: dto.score,
          feedback: dto.feedback,
          gradedById: coachProfile.id,
          gradedAt: new Date()
        }
      })
    ]);

    return submission;
  }
}
