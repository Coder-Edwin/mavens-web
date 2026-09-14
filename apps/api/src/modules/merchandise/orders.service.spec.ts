import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let txOrderCreate: jest.Mock;

  const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };
  const parentUser: AuthenticatedUser = { userId: 'parent-user-1', email: 'p@x.com', role: 'PARENT', isCoach: false };

  beforeEach(async () => {
    txOrderCreate = jest.fn((a: any) => Promise.resolve({ id: 'order-1', ...a.data }));

    prisma = {
      parentProfile: { findUnique: jest.fn() },
      order: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })) },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          merchandiseItem: {
            findUnique: jest.fn().mockResolvedValue({ id: 'mi-1', name: 'T-Shirt', price: 1200, isActive: true }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 })
          },
          order: { create: txOrderCreate }
        })
      )
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('refuses a caller with no parent profile', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ items: [{ merchandiseItemId: 'mi-1', quantity: 1 }] }, parentUser)
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an empty order', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      await expect(service.create({ items: [] }, parentUser)).rejects.toThrow('An order needs at least one item');
    });

    it('computes the total from unit price x quantity and decrements stock', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      await service.create({ items: [{ merchandiseItemId: 'mi-1', quantity: 2 }] }, parentUser);
      const data = txOrderCreate.mock.calls[0][0].data;
      expect(data.parentId).toBe('parent-1');
      expect(data.totalAmount).toBe(2400);
      expect(data.items.create).toEqual([{ merchandiseItemId: 'mi-1', quantity: 2, size: undefined, unitPrice: 1200 }]);
    });

    it('rejects the order when a concurrent purchase already took the stock', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      prisma.$transaction.mockImplementationOnce((cb: any) =>
        cb({
          merchandiseItem: {
            findUnique: jest.fn().mockResolvedValue({ id: 'mi-1', name: 'T-Shirt', price: 1200, isActive: true }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }) // someone else took the last one
          },
          order: { create: txOrderCreate }
        })
      );
      await expect(
        service.create({ items: [{ merchandiseItemId: 'mi-1', quantity: 1 }] }, parentUser)
      ).rejects.toThrow(ConflictException);
    });

    it('404s on an inactive or unknown item', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      prisma.$transaction.mockImplementationOnce((cb: any) =>
        cb({
          merchandiseItem: { findUnique: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
          order: { create: txOrderCreate }
        })
      );
      await expect(
        service.create({ items: [{ merchandiseItemId: 'ghost', quantity: 1 }] }, parentUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('gives an admin every order with the product name per line', async () => {
      await service.findAll(admin);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { merchandiseItem: { select: { name: true } } } },
          parent: { select: { firstName: true, lastName: true } }
        }
      });
    });

    it('scopes a parent to only their own orders', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      await service.findAll(parentUser);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { parentId: 'parent-1' },
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      });
    });
  });

  describe('findOne', () => {
    it('blocks a parent from viewing someone else’s order', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', parentId: 'someone-elses-parent-id' });
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      await expect(service.findOne('order-1', parentUser)).rejects.toThrow(ForbiddenException);
    });

    it('lets the owning parent view it', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', parentId: 'parent-1' });
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      await expect(service.findOne('order-1', parentUser)).resolves.toMatchObject({ id: 'order-1' });
    });
  });

  describe('updateStatus', () => {
    it('404s on an unknown order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('ghost', { status: 'FULFILLED' })).rejects.toThrow(NotFoundException);
    });

    it('updates the status', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: 'PENDING' });
      const updated = await service.updateStatus('order-1', { status: 'FULFILLED' });
      expect(updated).toMatchObject({ id: 'order-1', status: 'FULFILLED' });
    });
  });
});
