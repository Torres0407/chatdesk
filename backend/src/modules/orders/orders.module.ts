import { Module } from '@nestjs/common';
import { OrderService } from './services/order.service';
import { OrderTransitionService } from './services/order-transition.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';

import { OrdersController } from './orders.controller';

@Module({
  imports: [PrismaModule, CartModule, OutboundMessageModule],
  controllers: [OrdersController],
  providers: [OrderService, OrderTransitionService],
  exports: [OrderService, OrderTransitionService],
})
export class OrdersModule {}
