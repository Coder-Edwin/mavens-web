import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

type Audience = 'ALL' | 'PARENTS' | 'STUDENTS' | 'COACHES';

/// Which audiences a given user should see in their feed. 'ALL' always
/// applies; role maps to its group; isCoach (e.g. Amwai, an ADMIN who also
/// coaches) additionally pulls in COACHES broadcasts.
export function audiencesFor(user: AuthenticatedUser): Audience[] {
  const list: Audience[] = ['ALL'];
  if (user.role === 'PARENT') list.push('PARENTS');
  if (user.role === 'STUDENT') list.push('STUDENTS');
  if (user.role === 'COACH' || user.isCoach) list.push('COACHES');
  return list;
}

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAnnouncementDto, currentUser: AuthenticatedUser) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: dto.audience ?? 'ALL',
        authorId: currentUser.userId
      }
    });
  }

  findAllForAdmin() {
    return this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { email: true } } }
    });
  }

  /// What the current user sees in their dashboard.
  feedFor(currentUser: AuthenticatedUser) {
    return this.prisma.announcement.findMany({
      where: { audience: { in: audiencesFor(currentUser) } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, body: true, audience: true, createdAt: true }
    });
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }
    return this.prisma.announcement.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        body: dto.body?.trim() ?? undefined,
        audience: dto.audience ?? undefined
      }
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }
    await this.prisma.announcement.delete({ where: { id } });
    return { id };
  }
}
