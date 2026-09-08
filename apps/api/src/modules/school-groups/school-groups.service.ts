import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSchoolGroupDto } from './dto/create-school-group.dto';
import { UpdateSchoolGroupDto } from './dto/update-school-group.dto';

@Injectable()
export class SchoolGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSchoolGroupDto) {
    return this.prisma.schoolGroup.create({
      data: {
        institutionName: dto.institutionName.trim(),
        address: dto.address?.trim() || null,
        coordinatorName: dto.coordinatorName?.trim() || null,
        coordinatorPhone: dto.coordinatorPhone?.trim() || null,
        coordinatorEmail: dto.coordinatorEmail?.trim().toLowerCase() || null,
        agreedGroupSize: dto.agreedGroupSize ?? null,
        status: dto.status ?? 'PROSPECT',
        notes: dto.notes?.trim() || null
      }
    });
  }

  findAll(status?: string) {
    const where =
      status && ['PROSPECT', 'ACTIVE', 'INACTIVE'].includes(status)
        ? { status: status as 'PROSPECT' | 'ACTIVE' | 'INACTIVE' }
        : undefined;
    return this.prisma.schoolGroup.findMany({
      where,
      orderBy: [{ status: 'asc' }, { institutionName: 'asc' }],
      include: { _count: { select: { enrollments: true } } }
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.schoolGroup.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true } } }
    });
    if (!group) throw new NotFoundException('School group not found');
    return group;
  }

  async update(id: string, dto: UpdateSchoolGroupDto) {
    await this.findOne(id);
    return this.prisma.schoolGroup.update({
      where: { id },
      data: {
        institutionName: dto.institutionName?.trim() ?? undefined,
        address: dto.address !== undefined ? dto.address.trim() || null : undefined,
        coordinatorName:
          dto.coordinatorName !== undefined ? dto.coordinatorName.trim() || null : undefined,
        coordinatorPhone:
          dto.coordinatorPhone !== undefined ? dto.coordinatorPhone.trim() || null : undefined,
        coordinatorEmail:
          dto.coordinatorEmail !== undefined
            ? dto.coordinatorEmail.trim().toLowerCase() || null
            : undefined,
        agreedGroupSize: dto.agreedGroupSize ?? undefined,
        status: dto.status ?? undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      }
    });
  }

  async remove(id: string) {
    const group = await this.prisma.schoolGroup.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true } } }
    });
    if (!group) throw new NotFoundException('School group not found');
    if (group._count.enrollments > 0) {
      throw new BadRequestException(
        'This school group has enrollments — set it to INACTIVE instead of deleting it.'
      );
    }
    await this.prisma.schoolGroup.delete({ where: { id } });
    return { id };
  }
}
