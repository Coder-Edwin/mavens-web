import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStudentDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: 'STUDENT',
        studentProfile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
            ...(dto.coachId && {
              coachLinks: {
                create: { coachId: dto.coachId }
              }
            })
          }
        }
      },
      include: { studentProfile: true }
    });

    return {
      student: user.studentProfile,
      tempPassword
    };
  }

  /// `scope` is a deliberate, explicit override: when the caller genuinely
  /// IS a coach (isCoach: true) and asks for scope === 'own', the coach
  /// branch runs even though their primary role is ADMIN. Without this,
  /// role === 'ADMIN' always wins and an admin-who-is-also-a-coach can
  /// never see just their OWN roster — exactly the bug that let Brian show
  /// up in Amwai's "coach view" checklist even though Brian was never
  /// assigned to him.
  async findAll(currentUser: AuthenticatedUser, scope?: string) {
    const wantsCoachView = scope === 'own' && currentUser.isCoach;

    if (currentUser.role === 'ADMIN' && !wantsCoachView) {
      return this.prisma.studentProfile.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      });
    }

    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (!coachProfile) return [];

      return this.prisma.studentProfile.findMany({
        where: { coachLinks: { some: { coachId: coachProfile.id } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      });
    }

    if (currentUser.role === 'PARENT') {
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (!parentProfile) return [];

      return this.prisma.studentProfile.findMany({
        where: { parentLinks: { some: { parentId: parentProfile.id } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      });
    }

    throw new ForbiddenException('You do not have permission to list students');
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        coachLinks: true,
        parentLinks: true,
        user: { select: { email: true, isActive: true } }
      }
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.assertCanAccess(student, currentUser);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return this.prisma.studentProfile.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined
      }
    });
  }

  private async assertCanAccess(
    student: {
      id: string;
      userId: string;
      coachLinks: { coachId: string }[];
      parentLinks: { parentId: string }[];
    },
    currentUser: AuthenticatedUser
  ) {
    if (currentUser.role === 'ADMIN') return;

    if (currentUser.role === 'STUDENT') {
      if (student.userId === currentUser.userId) return;
      throw new ForbiddenException('You can only view your own profile');
    }

    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coachProfile = await this.prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (coachProfile && student.coachLinks.some((link) => link.coachId === coachProfile.id)) {
        return;
      }
      throw new ForbiddenException("You are not this student's coach");
    }

    if (currentUser.role === 'PARENT') {
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (parentProfile && student.parentLinks.some((link) => link.parentId === parentProfile.id)) {
        return;
      }
      throw new ForbiddenException('You are not linked to this student');
    }

    throw new ForbiddenException('You do not have permission to view this student');
  }
}
