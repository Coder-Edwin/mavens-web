import { Module } from '@nestjs/common';
import { MerchandiseItemsController } from './merchandise-items.controller';
import { OrdersController } from './orders.controller';
import { MerchandiseItemsService } from './merchandise-items.service';
import { OrdersService } from './orders.service';

@Module({
  controllers: [MerchandiseItemsController, OrdersController],
  providers: [MerchandiseItemsService, OrdersService]
})
export class MerchandiseModule {}
