import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

/// Deliberately has NO guards, unlike every other controller in this app.
/// Safaricom's servers call this endpoint directly — they cannot send our
/// JWT. Trust is established inside PaymentsService.handleStkCallback by
/// matching the CheckoutRequestID against a transaction we already created,
/// not by authentication middleware. Kept as its own controller (rather
/// than a route on PaymentsController) so this exception is obvious at a
/// glance rather than hidden as one unguarded method among guarded ones.
@Controller('payments/mpesa')
export class MpesaWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // POST /api/v1/payments/mpesa/callback — called by Safaricom, never by our own frontend
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  handleCallback(@Body() body: unknown) {
    return this.paymentsService.handleStkCallback(body);
  }
}
