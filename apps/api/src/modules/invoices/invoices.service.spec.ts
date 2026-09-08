import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RateCardsService } from '../rate-cards/rate-cards.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let rateCards: { resolve: jest.Mock };
  let txInvoiceCreate: jest.Mock;
  let txInvoiceUpdate: jest.Mock;
  let txPaymentCreate: jest.Mock;
  let prisma: any;

  beforeEach(async () => {
    txInvoiceCreate = jest.fn((a: any) => Promise.resolve({ id: 'inv-1', ...a.data }));
    txInvoiceUpdate = jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data }));
    txPaymentCreate = jest.fn().mockResolvedValue({});

    prisma = {
      enrollment: { findUnique: jest.fn() },
      schoolGroup: { findUnique: jest.fn() },
      sessionAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      session: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })), delete: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          invoice: { count: jest.fn().mockResolvedValue(2), create: txInvoiceCreate, update: txInvoiceUpdate },
          invoicePayment: { create: txPaymentCreate }
        })
      )
    };
    rateCards = { resolve: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RateCardsService, useValue: rateCards }
      ]
    }).compile();
    service = module.get(InvoicesService);
  });

  afterEach(() => jest.clearAllMocks());

  const enrollment = {
    id: 'enr-1',
    deliveryType: 'CENTER',
    level: 'NOVICE',
    clientType: 'INDIVIDUAL',
    studentId: 'stu-1',
    student: { id: 'stu-1', parentLinks: [{ parent: { userId: 'parent-user-1' } }] }
  };

  describe('generateForEnrollment', () => {
    it('rejects an unknown enrollment', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(
        service.generateForEnrollment({ enrollmentId: 'ghost', periodStart: '2026-06-01', periodEnd: '2026-06-30' })
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when no rate card matches', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment);
      rateCards.resolve.mockResolvedValue(null);
      await expect(
        service.generateForEnrollment({ enrollmentId: 'enr-1', periodStart: '2026-06-01', periodEnd: '2026-06-30' })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a PER_SESSION invoice with no attended sessions', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment);
      rateCards.resolve.mockResolvedValue({ id: 'rc', unit: 'PER_SESSION', amount: 1500, currency: 'KES' });
      prisma.sessionAttendance.findMany.mockResolvedValue([]);
      await expect(
        service.generateForEnrollment({ enrollmentId: 'enr-1', periodStart: '2026-06-01', periodEnd: '2026-06-30' })
      ).rejects.toThrow(BadRequestException);
    });

    it('bills one line per attended completed session', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment);
      rateCards.resolve.mockResolvedValue({ id: 'rc', unit: 'PER_SESSION', amount: 1500, currency: 'KES' });
      prisma.sessionAttendance.findMany.mockResolvedValue([
        { session: { id: 's1', topic: 'Pins', date: new Date('2026-06-06') } },
        { session: { id: 's2', topic: 'Forks', date: new Date('2026-06-13') } },
        { session: { id: 's3', topic: 'Skewers', date: new Date('2026-06-20') } }
      ]);
      await service.generateForEnrollment({ enrollmentId: 'enr-1', periodStart: '2026-06-01', periodEnd: '2026-06-30' });

      const data = txInvoiceCreate.mock.calls[0][0].data;
      expect(data.number).toBe('INV-2026-0003'); // count was 2 -> seq 3
      expect(data.billToUserId).toBe('parent-user-1');
      expect(data.subtotal).toBe(4500);
      expect(data.total).toBe(4500);
      expect(data.lines.create).toHaveLength(3);
      expect(data.lines.create[0]).toMatchObject({ amount: 1500, sessionId: 's1', rateCardId: 'rc' });
    });

    it('bills a single line for a PER_MONTH card spanning three months', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment);
      rateCards.resolve.mockResolvedValue({ id: 'rc', unit: 'PER_MONTH', amount: 4000, currency: 'KES' });
      await service.generateForEnrollment({ enrollmentId: 'enr-1', periodStart: '2026-05-01', periodEnd: '2026-07-31' });
      const data = txInvoiceCreate.mock.calls[0][0].data;
      expect(data.lines.create).toHaveLength(1);
      expect(data.lines.create[0]).toMatchObject({ quantity: 3, unitAmount: 4000, amount: 12000 });
      expect(data.subtotal).toBe(12000);
    });
  });

  describe('recordPayment', () => {
    it('marks the invoice PARTIAL then PAID as payments land', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'SENT', total: 4500, amountPaid: 0 });
      await service.recordPayment('inv-1', { amount: 2000 });
      expect(txInvoiceUpdate.mock.calls[0][0].data).toMatchObject({ amountPaid: 2000, status: 'PARTIAL' });

      prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'PARTIAL', total: 4500, amountPaid: 2000 });
      await service.recordPayment('inv-1', { amount: 2500 });
      expect(txInvoiceUpdate.mock.calls[1][0].data).toMatchObject({ amountPaid: 4500, status: 'PAID' });
    });

    it('refuses a payment on a void invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'VOID', total: 4500, amountPaid: 0 });
      await expect(service.recordPayment('inv-1', { amount: 100 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('lifecycle guards', () => {
    it('only issues a draft', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'SENT' });
      await expect(service.issue('inv-1', {})).rejects.toThrow(BadRequestException);
    });

    it('will not void a paid invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'PAID' });
      await expect(service.voidInvoice('inv-1')).rejects.toThrow(BadRequestException);
    });

    it('only deletes a draft', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'SENT' });
      await expect(service.remove('inv-1')).rejects.toThrow(BadRequestException);
    });
  });
});
