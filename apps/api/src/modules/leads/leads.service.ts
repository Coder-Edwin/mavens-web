import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PlacementsService } from '../placements/placements.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function tempCredential() {
  const password = crypto.randomBytes(6).toString('hex');
  const hash = await bcrypt.hash(password, 10);
  return { password, hash };
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
    private readonly placements: PlacementsService
  ) {}

  /// Public: create an interest submission. Always starts as NEW.
  create(dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        parentName: dto.parentName.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone.trim(),
        childName: dto.childName?.trim() || null,
        childAge: dto.childAge ?? null,
        message: dto.message?.trim() || null
      }
    });
  }

  /// Admin inbox. Optional ?status= filter; newest first, but NEW leads
  /// always float to the top so nothing waiting on a first response is buried.
  async findAllForAdmin(status?: string) {
    const where =
      status && ['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'].includes(status)
        ? { status: status as 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED' }
        : undefined;

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    if (where) return leads;
    // Stable partition on the createdAt-desc list: un-triaged (NEW) first.
    const isNew = (s: string) => s === 'NEW';
    return [
      ...leads.filter((l) => isNew(l.status)),
      ...leads.filter((l) => !isNew(l.status))
    ];
  }

  async update(id: string, dto: UpdateLeadDto) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Lead not found');
    }
    return this.prisma.lead.update({
      where: { id },
      data: {
        status: dto.status ?? undefined,
        notes: dto.notes ?? undefined
      }
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Lead not found');
    }
    await this.prisma.lead.delete({ where: { id } });
    return { id };
  }

  /// Admin: promote a lead to a student record. Optionally links a parent
  /// account, opens an enrollment and books a placement in one step. The
  /// student + parent + lead-status changes are atomic; the enrollment and
  /// placement are added afterwards and are independently retryable.
  async convert(id: string, dto: ConvertLeadDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.convertedToStudentId) {
      throw new ConflictException('This lead has already been converted');
    }

    const studentEmail = dto.studentEmail.trim().toLowerCase();
    const parentEmail = lead.email.trim().toLowerCase();
    const linkParent = dto.linkParent !== false;

    if (linkParent && studentEmail === parentEmail) {
      throw new BadRequestException(
        'The student needs a different login email from the parent'
      );
    }
    if (dto.createEnrollment && !dto.deliveryType) {
      throw new BadRequestException('deliveryType is required to open an enrollment');
    }

    if (await this.prisma.user.findUnique({ where: { email: studentEmail } })) {
      throw new ConflictException('A user with the student email already exists');
    }

    const studentCred = await tempCredential();

    const { student, parentTempPassword } = await this.prisma.$transaction(async (tx) => {
      const studentUser = await tx.user.create({
        data: {
          email: studentEmail,
          passwordHash: studentCred.hash,
          role: 'STUDENT',
          studentProfile: {
            create: {
              firstName: dto.studentFirstName.trim(),
              lastName: dto.studentLastName.trim(),
              dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
              homeAddress: dto.homeAddress?.trim() || null,
              priorExperience: lead.priorExperience ?? null,
              level: dto.level ?? undefined
            }
          }
        },
        include: { studentProfile: true }
      });
      const createdStudent = studentUser.studentProfile!;

      let parentTemp: string | null = null;
      if (linkParent) {
        const existingParentUser = await tx.user.findUnique({
          where: { email: parentEmail },
          include: { parentProfile: true }
        });

        let parentProfileId: string;
        if (existingParentUser?.parentProfile) {
          parentProfileId = existingParentUser.parentProfile.id;
        } else if (existingParentUser) {
          const { firstName, lastName } = splitName(lead.parentName);
          const created = await tx.parentProfile.create({
            data: { userId: existingParentUser.id, firstName, lastName, phone: lead.phone }
          });
          parentProfileId = created.id;
        } else {
          const parentCred = await tempCredential();
          const { firstName, lastName } = splitName(lead.parentName);
          const parentUser = await tx.user.create({
            data: {
              email: parentEmail,
              passwordHash: parentCred.hash,
              role: 'PARENT',
              parentProfile: { create: { firstName, lastName, phone: lead.phone } }
            },
            include: { parentProfile: true }
          });
          parentProfileId = parentUser.parentProfile!.id;
          parentTemp = parentCred.password;
        }

        await tx.parentStudent.create({
          data: { parentId: parentProfileId, studentId: createdStudent.id }
        });
      }

      await tx.lead.update({
        where: { id },
        data: { status: 'ENROLLED', convertedToStudentId: createdStudent.id }
      });

      return { student: createdStudent, parentTempPassword: parentTemp };
    });

    let enrollment = null;
    if (dto.createEnrollment) {
      enrollment = await this.enrollments.create({
        studentId: student.id,
        deliveryType: dto.deliveryType!,
        schoolGroupId: dto.schoolGroupId,
        level: dto.level,
        assignedCoachId: dto.assignedCoachId
      });
    }

    let placement = null;
    if (dto.schedulePlacement) {
      placement = await this.placements.schedule({
        studentId: student.id,
        enrollmentId: enrollment?.id,
        scheduledFor: dto.placementScheduledFor,
        assessorCoachId: dto.assignedCoachId
      });
    }

    return {
      student,
      studentTempPassword: studentCred.password,
      parentTempPassword,
      enrollment,
      placement
    };
  }
}
