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

  /// Parent pays for one of their OWN children. Same ownership pattern as
  /// every other module: role alone doesn't prove they're linked to this
  /// specific student — that's checked against ParentStudent directly.
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

    // Reuse an existing subscription for this student+plan if one exists,
    // otherwise start one. It stays OVERDUE until the callback confirms payment.
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

    const payment = await this.prisma.payment.create({
      data: {
        studentId: dto.studentId,
        subscriptionId: subscription.id,
        type: 'SUBSCRIPTION',
        status: 'PENDING',
        method: 'MPESA',
        amount: plan.amount
      }
    });

    const stkResult = await this.mpesaService.initiateStkPush({
      phoneNumber: dto.phoneNumber,
      amount: Number(plan.amount),
      accountReference: `${student.firstName}${student.lastName}`,
      transactionDesc: 'Mavens Chess Club subscription'
    });

    await this.prisma.mpesaTransaction.create({
      data: {
        paymentId: payment.id,
        phoneNumber: dto.phoneNumber,
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId
      }
    });

    return {
      paymentId: payment.id,
      status: 'PENDING',
      message: 'STK push sent — check your phone to complete payment.'
    };
  }

  /// Called only by MpesaWebhookController, which has no auth guard.
  /// Trust comes from the CheckoutRequestID matching a transaction WE
  /// created when initiateSubscriptionPayment ran — not from a token.
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
      // Unknown transaction — acknowledge anyway so Safaricom stops retrying;
      // throwing here would just cause repeated re-delivery of the same callback.
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

  /// Used by the frontend to poll "did it go through yet?" after the
  /// STK push modal shows its "sending..." state.
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
