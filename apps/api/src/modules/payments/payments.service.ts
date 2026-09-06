import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MpesaService } from './mpesa.service';
import { InitiateStkPushDto } from './dto/initiate-stk-push.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesaService: MpesaService
  ) {}

  async initiateSubscriptionPayment(dto: InitiateStkPushDto, currentUser: AuthenticatedUser) {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId: currentUser.userId }
    });
    if (!parentProfile) {
      throw new ForbiddenException('Only parents can make payments');
    }

    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: parentProfile.id, studentId: dto.studentId } }
    });
    if (!link) {
      throw new ForbiddenException('You are not linked to this student');
    }

    const student = await this.prisma.studentProfile.findUnique({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { isActive: true } });
    if (!plan) {
      throw new BadRequestException('No active subscription plan is configured');
    }

    let subscription = await this.prisma.subscription.findFirst({
      where: { studentId: dto.studentId, planId: plan.id },
      orderBy: { currentPeriodEnd: 'desc' }
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (!subscription) {
      subscription = await this.prisma.subscription.create({
        data: {
          studentId: dto.studentId,
          planId: plan.id,
          status: 'OVERDUE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd
        }
      });
    }

    // FIX: call Daraja BEFORE writing any Payment row. Previously the
    // Payment was created first, so every failed STK push attempt (e.g.
    // placeholder credentials) left a permanent, orphaned PENDING row
    // behind — visible as repeated duplicate entries in the admin
    // Payments table. Now, if this throws, nothing about this attempt
    // gets persisted at all.
    const stkResult = await this.mpesaService.initiateStkPush({
      phoneNumber: dto.phoneNumber,
      amount: Number(plan.amount),
      accountReference: `${student.firstName}${student.lastName}`,
      transactionDesc: 'Mavens Chess Club subscription'
    });

    // Only reached once Daraja has actually accepted the request. Payment
    // and its MpesaTransaction are created together, atomically, so we
    // never end up with one existing without the other.
    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          studentId: dto.studentId,
          subscriptionId: subscription.id,
          type: 'SUBSCRIPTION',
          status: 'PENDING',
          method: 'MPESA',
          amount: plan.amount
        }
      });

      await tx.mpesaTransaction.create({
        data: {
          paymentId: created.id,
          phoneNumber: dto.phoneNumber,
          checkoutRequestId: stkResult.checkoutRequestId,
          merchantRequestId: stkResult.merchantRequestId
        }
      });

      return created;
    });

    return {
      paymentId: payment.id,
      status: 'PENDING',
      message: 'STK push sent — check your phone to complete payment.'
    };
  }

  async handleStkCallback(body: any) {
    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return { ResultCode: 0, ResultDesc: 'Ignored: unrecognized payload' };
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const transaction = await this.prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId },
      include: { payment: true }
    });

    if (!transaction) {
      return { ResultCode: 0, ResultDesc: 'Acknowledged: unknown transaction' };
    }

    const resultCode: number = callback.ResultCode;
    const resultDesc: string = callback.ResultDesc;
    const success = resultCode === 0;

    let mpesaReceiptNumber: string | undefined;
    if (success && callback.CallbackMetadata?.Item) {
      const items: { Name: string; Value: unknown }[] = callback.CallbackMetadata.Item;
      mpesaReceiptNumber = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value as
        | string
        | undefined;
    }

    await this.prisma.mpesaTransaction.update({
      where: { id: transaction.id },
      data: { resultCode, resultDesc, mpesaReceiptNumber, rawCallback: body }
    });

    await this.prisma.payment.update({
      where: { id: transaction.paymentId },
      data: {
        status: success ? 'PAID' : 'FAILED',
        paidAt: success ? new Date() : undefined
      }
    });

    if (success && transaction.payment.subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: transaction.payment.subscriptionId },
        data: { status: 'ACTIVE' }
      });
    }

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  async findAllForAdmin() {
    return this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { firstName: true, lastName: true } }
      }
    });
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { mpesaTransaction: true, student: true }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (currentUser.role === 'ADMIN') return payment;

    if (currentUser.role === 'PARENT') {
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId: currentUser.userId }
      });
      if (parentProfile && payment.studentId) {
        const link = await this.prisma.parentStudent.findUnique({
          where: { parentId_studentId: { parentId: parentProfile.id, studentId: payment.studentId } }
        });
        if (link) return payment;
      }
      throw new ForbiddenException('You are not linked to this payment');
    }

    throw new ForbiddenException('You do not have permission to view this payment');
  }
}
