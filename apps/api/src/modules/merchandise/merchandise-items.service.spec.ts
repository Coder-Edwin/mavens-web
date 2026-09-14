import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MerchandiseItemsService } from './merchandise-items.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('MerchandiseItemsService', () => {
  let service: MerchandiseItemsService;
  let prisma: {
    merchandiseItem: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      merchandiseItem: {
        create: jest.fn((a: any) => Promise.resolve({ id: 'mi-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data }))
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchandiseItemsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(MerchandiseItemsService);
  });

  afterEach(() => jest.clearAllMocks());

  const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };
  const parent: AuthenticatedUser = { userId: 'parent-1', email: 'p@x.com', role: 'PARENT', isCoach: false };

  describe('create', () => {
    it('creates an item from the dto as-is', async () => {
      const created = await service.create({
        name: 'Club T-Shirt',
        price: 1200,
        stockQuantity: 20
      } as any);
      expect(created).toMatchObject({ name: 'Club T-Shirt', price: 1200, stockQuantity: 20 });
    });
  });

  describe('findAll', () => {
    it('shows an admin the full catalog, including inactive/out-of-stock items', async () => {
      await service.findAll(admin);
      expect(prisma.merchandiseItem.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });

    it('only shows a non-admin what is actually active', async () => {
      await service.findAll(parent);
      expect(prisma.merchandiseItem.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });
    });
  });

  describe('update', () => {
    it('404s on an unknown item', async () => {
      prisma.merchandiseItem.findUnique.mockResolvedValue(null);
      await expect(service.update('ghost', { price: 1000 })).rejects.toThrow(NotFoundException);
    });

    it('persists a partial update (e.g. restocking)', async () => {
      prisma.merchandiseItem.findUnique.mockResolvedValue({ id: 'mi-1', stockQuantity: 0 });
      await service.update('mi-1', { stockQuantity: 15 });
      expect(prisma.merchandiseItem.update).toHaveBeenCalledWith({
        where: { id: 'mi-1' },
        data: { stockQuantity: 15 }
      });
    });
  });
});
