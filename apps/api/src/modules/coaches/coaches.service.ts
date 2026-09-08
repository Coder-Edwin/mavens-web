import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCoachDto } from './dto/create-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';

@Injectable()
export class CoachesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
    user: { select: { email: true, isActive: true } }
  } satisfies Prisma.CoachProfileInclude;

  async create(dto: CreateCoachDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'COACH',
        coachProfile: {
          create: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            phone: dto.phone?.trim() || null,
            specialty: dto.specialty?.trim() || null,
            bio: dto.bio?.trim() || null,
            skills: dto.skills?.trim() || null,
            employmentType: dto.employmentType ?? 'STAFF'
          }
        }
      },
      include: { coachProfile: true }
    });

    return { coach: user.coachProfile, tempPassword };
  }

  findAll() {
    return this.prisma.coachProfile.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'asc' }],
      include: this.userSelect
    });
  }

  async findOne(id: string) {
    const coach = await this.prisma.coachProfile.findUnique({
      where: { id },
      include: this.userSelect
    });
    if (!coach) throw new NotFoundException('Coach not found');
    return coach;
  }

  async update(id: string, dto: UpdateCoachDto) {
    await this.findOne(id);
    return this.prisma.coachProfile.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim() ?? undefined,
        lastName: dto.lastName?.trim() ?? undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
        specialty: dto.specialty !== undefined ? dto.specialty.trim() || null : undefined,
        bio: dto.bio !== undefined ? dto.bio.trim() || null : undefined,
        skills: dto.skills !== undefined ? dto.skills.trim() || null : undefined,
        employmentType: dto.employmentType ?? undefined
      },
      include: this.userSelect
    });
  }
}
