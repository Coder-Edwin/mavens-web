import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateMerchandiseItemDto } from './dto/create-merchandise-item.dto';
import { UpdateMerchandiseItemDto } from './dto/update-merchandise-item.dto';

@Injectable()
export class MerchandiseItemsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMerchandiseItemDto) {
    return this.prisma.merchandiseItem.create({ data: dto });
  }

  // Admin sees the full catalog, including inactive/out-of-stock items
  // (they need that to manage inventory). Everyone else only sees what's
  // actually purchasable right now.
  findAll(currentUser: AuthenticatedUser) {
    if (currentUser.role === 'ADMIN') {
      return this.prisma.merchandiseItem.findMany({ orderBy: { name: 'asc' } });
    }
    return this.prisma.merchandiseItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  async update(id: string, dto: UpdateMerchandiseItemDto) {
    const item = await this.prisma.merchandiseItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Merchandise item not found');
    }
    return this.prisma.merchandiseItem.update({ where: { id }, data: dto });
  }
}
