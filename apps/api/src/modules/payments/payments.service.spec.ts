import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MpesaService } from './mpesa.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const parent: AuthenticatedUser = {
  userId: 'user-1',
  email: 'grace@example.com',
  role: 'PARENT',
  isCoach: false
};
const dto = { studentId: 'student-1', phoneNumber: '254712345678' };

describe('PaymentsService — membership (Feature E)', () => {
  let service: PaymentsService;
  let prisma: any;
  let mpesa: { initiateStkPush: jest.Mock };

  const txCreates: any[] = [];

  beforeEach(async () => {
    txCreates.length = 0;
    prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'parent-1' }) },
      parentStudent: { findUnique: jest.fn().mockResolvedValue({ parentId: 'parent-1', studentId: 'student-1' }) },
      studentProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1', firstName: 'Faith', lastName: 'Wambui' }) },
      subscriptionPlan: { findFirst: jest.fn() },
      subscription: { findFirst: jest.fn(), create: jest.fn() },
      membership: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((a) => Promise.resolve({ id: 'mem-1', ...a.data })),
        update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data }))
      },
      payment: { update: jest.fn(), findUnique: jest.fn() },
      mpesaTransaction: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(async (cb: any) => {
        const tx = {
          payment: {
            create: jest.fn((a) => {
              txCreates.push({ model: 'payment', data: a.data });
              return Promise.resolve({ id: 'pay-1', ...a.data });
            })
          },
          mpesaTransaction: {
            create: jest.fn((a) => {
              txCreates.push({ model: 'mpesaTransaction', data: a.data });
              return Promise.resolve({ id: 'mtx-1', ...a.data });
            })
          }
        };
        return cb(tx);
      })
    };
    mpesa = {
      initiateStkPush: jest.fn().mockResolvedValue({
        checkoutRequestId: 'CR-1',
        merchantRequestId: 'MR-1',
        responseCode: '0',
        responseDescription: 'ok'
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MpesaService, useValue: mpesa }
      ]
    }).compile();
    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('initiateMembershipPayment', () => {
    it('rejects a parent not linked to the student', async () => {
      prisma.parentStudent.findUnique.mockResolvedValue(null);
      await expect(service.initiateMembershipPayment(dto, parent)).rejects.toThrow(ForbiddenException);
    });

    it('rejects when no active YEARLY membership fee is configured', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue(null);
      await expect(service.initiateMembershipPayment(dto, parent)).rejects.toThrow(BadRequestException);
      expect(prisma.subscriptionPlan.findFirst).toHaveBeenCalledWith({
        where: { isActive: true, billingCycle: 'YEARLY' }
      });
    });

    it('writes nothing when the Daraja call fails', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 'plan-y', amount: 6000, billingCycle: 'YEARLY' });
      mpesa.initiateStkPush.mockRejectedValue(new Error('no credentials'));

      await expect(service.initiateMembershipPayment(dto, parent)).rejects.toThrow('no credentials');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(txCreates).toHaveLength(0);
    });

    it('creates a MEMBERSHIP payment + M-Pesa transaction together after Daraja accepts', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 'plan-y', amount: 6000, billingCycle: 'YEARLY' });

      const result = await service.initiateMembershipPayment(dto, parent);

      // membership row created before the Daraja call (mirrors the subscription flow)
      expect(prisma.membership.create).toHaveBeenCalledTimes(1);
      const payCreate = txCreates.find((c) => c.model === 'payment');
      expect(payCreate.data).toMatchObject({
        studentId: 'student-1',
        membershipId: 'mem-1',
        type: 'MEMBERSHIP',
        status: 'PENDING'
      });
      expect(txCreates.find((c) => c.model === 'mpesaTransaction').data.checkoutRequestId).toBe('CR-1');
      expect(result.paymentId).toBe('pay-1');
    });

    it('reuses an existing membership row for the student', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 'plan-y', amount: 6000, billingCycle: 'YEARLY' });
      prisma.membership.findFirst.mockResolvedValue({ id: 'mem-existing', planId: 'plan-y' });

      await service.initiateMembershipPayment(dto, parent);

      expect(prisma.membership.create).not.toHaveBeenCalled();
      expect(txCreates.find((c) => c.model === 'payment').data.membershipId).toBe('mem-existing');
    });
  });

  describe('handleStkCallback — membership activation', () => {
    const callbackBody = (code: number) => ({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'CR-1',
          ResultCode: code,
          ResultDesc: code === 0 ? 'Success' : 'Cancelled',
          CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: 'QWE123' }] }
        }
      }
    });

    it('activates the membership and refreshes its period on a successful payment', async () => {
      prisma.mpesaTransaction.findUnique.mockResolvedValue({
        id: 'mtx-1',
        paymentId: 'pay-1',
        payment: { subscriptionId: null, membershipId: 'mem-1' }
      });

      await service.handleStkCallback(callbackBody(0));

      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mem-1' }, data: expect.objectContaining({ status: 'ACTIVE' }) })
      );
      const data = prisma.membership.update.mock.calls[0][0].data;
      expect(data.periodEnd.getFullYear() - data.periodStart.getFullYear()).toBe(1);
    });

    it('leaves the membership alone when the payment failed', async () => {
      prisma.mpesaTransaction.findUnique.mockResolvedValue({
        id: 'mtx-1',
        paymentId: 'pay-1',
        payment: { subscriptionId: null, membershipId: 'mem-1' }
      });

      await service.handleStkCallback(callbackBody(1032));

      expect(prisma.membership.update).not.toHaveBeenCalled();
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
      );
    });
  });

  describe('initiateSubscriptionPayment', () => {
    it('only picks a MONTHLY plan now that YEARLY membership plans exist', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 'plan-m', amount: 3500, billingCycle: 'MONTHLY' });
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

      await service.initiateSubscriptionPayment(dto, parent);

      expect(prisma.subscriptionPlan.findFirst).toHaveBeenCalledWith({
        where: { isActive: true, billingCycle: 'MONTHLY' }
      });
    });
  });
});
