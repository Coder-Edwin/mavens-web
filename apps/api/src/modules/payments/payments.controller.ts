import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiateStkPushDto } from './dto/initiate-stk-push.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // POST /api/v1/payments/mpesa/stk-push — parent only, ownership-checked.
  // Monthly class subscription.
  @Post('mpesa/stk-push')
  @UseGuards(RolesGuard)
  @Roles('PARENT')
  initiateStkPush(@Body() dto: InitiateStkPushDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.initiateSubscriptionPayment(dto, user);
  }

  // POST /api/v1/payments/mpesa/membership-stk-push — parent only.
  // Yearly club membership fee.
  @Post('mpesa/membership-stk-push')
  @UseGuards(RolesGuard)
  @Roles('PARENT')
  initiateMembershipStkPush(@Body() dto: InitiateStkPushDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.initiateMembershipPayment(dto, user);
  }

  // GET /api/v1/payments/membership/:studentId — current membership for a
  // student. Ownership enforced in the service. Declared before :id.
  @Get('membership/:studentId')
  membershipForStudent(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.paymentsService.findMembershipForStudent(studentId, user);
  }

  // GET /api/v1/payments — admin only, lists every payment club-wide
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.paymentsService.findAllForAdmin();
  }

  // GET /api/v1/payments/:id — ownership enforced in the service; used by the
  // frontend to poll status after showing the "sending..." modal state
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findOne(id, user);
  }
}
