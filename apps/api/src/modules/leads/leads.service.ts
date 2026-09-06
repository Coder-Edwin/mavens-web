import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
