import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';

export interface RateContext {
  deliveryType: 'HOME' | 'CENTER' | 'SCHOOL_GROUP';
  level: 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | null;
  clientType: 'INDIVIDUAL' | 'INSTITUTION';
}

@Injectable()
export class RateCardsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateRateCardDto) {
    return this.prisma.rateCard.create({
      data: {
        name: dto.name.trim(),
        deliveryType: dto.deliveryType,
        level: dto.level ?? null,
        clientType: dto.clientType ?? null,
        unit: dto.unit ?? 'PER_SESSION',
        amount: dto.amount,
        currency: dto.currency?.trim().toUpperCase() || 'KES',
        active: dto.active ?? true,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        notes: dto.notes?.trim() || null
      }
    });
  }

  findAll(filters: { deliveryType?: string; active?: string } = {}) {
    const where: Prisma.RateCardWhereInput = {};
    if (filters.deliveryType && ['HOME', 'CENTER', 'SCHOOL_GROUP'].includes(filters.deliveryType)) {
      where.deliveryType = filters.deliveryType as RateContext['deliveryType'];
    }
    if (filters.active === 'true') where.active = true;
    if (filters.active === 'false') where.active = false;
    return this.prisma.rateCard.findMany({
      where,
      orderBy: [{ deliveryType: 'asc' }, { effectiveFrom: 'desc' }]
    });
  }

  async findOne(id: string) {
    const card = await this.prisma.rateCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Rate card not found');
    return card;
  }

  async update(id: string, dto: UpdateRateCardDto) {
    await this.findOne(id);
    return this.prisma.rateCard.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        deliveryType: dto.deliveryType ?? undefined,
        level: dto.level !== undefined ? dto.level : undefined,
        clientType: dto.clientType !== undefined ? dto.clientType : undefined,
        unit: dto.unit ?? undefined,
        amount: dto.amount ?? undefined,
        currency: dto.currency?.trim().toUpperCase() ?? undefined,
        active: dto.active ?? undefined,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo:
          dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined
      }
    });
  }

  async remove(id: string) {
    const card = await this.prisma.rateCard.findUnique({
      where: { id },
      include: { _count: { select: { invoiceLines: true } } }
    });
    if (!card) throw new NotFoundException('Rate card not found');
    if (card._count.invoiceLines > 0) {
      throw new BadRequestException(
        'This rate card is referenced by invoices — set it inactive instead of deleting it.'
      );
    }
    await this.prisma.rateCard.delete({ where: { id } });
    return { id };
  }

  /// Pick the best matching ACTIVE card in effect on `at`. A card whose
  /// level/clientType is set but does not match the context is disqualified;
  /// among the rest, more specific matches win, then the most recent
  /// effectiveFrom.
  async resolve(ctx: RateContext, at: Date) {
    const candidates = await this.prisma.rateCard.findMany({
      where: {
        deliveryType: ctx.deliveryType,
        active: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }]
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    let best: (typeof candidates)[number] | null = null;
    let bestScore = -1;
    for (const c of candidates) {
      if (c.level && c.level !== ctx.level) continue;
      if (c.clientType && c.clientType !== ctx.clientType) continue;
      const score = (c.level ? 2 : 0) + (c.clientType ? 1 : 0);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    return best;
  }
}
