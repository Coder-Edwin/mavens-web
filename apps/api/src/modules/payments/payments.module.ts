import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { MpesaWebhookController } from './mpesa-webhook.controller';
import { PaymentsService } from './payments.service';
import { MpesaService } from './mpesa.service';

@Module({
  controllers: [PaymentsController, MpesaWebhookController],
  providers: [PaymentsService, MpesaService]
})
export class PaymentsModule {}
