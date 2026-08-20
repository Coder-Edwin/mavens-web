import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /// Places an order and decrements stock SAFELY. Naively doing
  /// `stockQuantity - quantity` can go negative if two parents buy the
  /// last item at the same moment. Instead, each decrement is a
  /// CONDITIONAL update — `stockQuantity: { gte: quantity }` — and we
  /// check how many rows it actually matched. If a concurrent request
  /// already took the stock, this update matches zero rows (count: 0),
  /// and we reject the order instead of letting stock go negative.
  /// The whole thing runs inside $transaction so a failure on item 2 of 3
  /// rolls back item 1's decrement too — an order either fully succeeds
  /// or doesn't happen at all.
  async create(dto: CreateOrderDto, currentUser: AuthenticatedUser) {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId: currentUser.userId }
    });
    if (!parentProfile) {
      throw new ForbiddenException('Only parents can place merchandise orders');
    }

    if (dto.items.length === 0) {
      throw new BadRequestException('An order needs at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData: {
        merchandiseItemId: string;
        quantity: number;
        size?: string;
        unitPrice: number;
      }[] = [];

      for (const line of dto.items) {
        const item = await tx.merchandiseItem.findUnique({ where: { id: line.merchandiseItemId } });
        if (!item || !item.isActive) {
          throw new NotFoundException(`Merchandise item not found: ${line.merchandiseItemId}`);
        }

        const decrement = await tx.merchandiseItem.updateMany({
          where: { id: line.merchandiseItemId, stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } }
        });
        if (decrement.count === 0) {
          throw new ConflictException(`Not enough stock for "${item.name}"`);
        }

        const unitPrice = Number(item.price);
        totalAmount += unitPrice * line.quantity;
        orderItemsData.push({
          merchandiseItemId: line.merchandiseItemId,
          quantity: line.quantity,
          size: line.size,
          unitPrice
        });
      }

      return tx.order.create({
        data: {
          parentId: parentProfile.id,
          totalAmount,
          items: { create: orderItemsData }
        },
        include: { items: true }
      });
    });
  }

  async findAll(currentUser: AuthenticatedUser) {
    if (currentUser.role === 'ADMIN') {
      return this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: { items: true, parent: { select: { firstName: true, lastName: true } } }
      });
    }

    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId: currentUser.userId }
    });
    if (!parentProfile) {
      throw new ForbiddenException('Only parents and admins can list orders');
    }

    return this.prisma.order.findMany({
      where: { parentId: parentProfile.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    });
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { merchandiseItem: true } }, parent: true }
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (currentUser.role === 'ADMIN') return order;

    if (currentUser.role === 'PARENT') {
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (parentProfile && order.parentId === parentProfile.id) return order;
      throw new ForbiddenException('This is not your order');
    }

    throw new ForbiddenException('You do not have permission to view this order');
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.prisma.order.update({ where: { id }, data: { status: dto.status } });
  }
}
