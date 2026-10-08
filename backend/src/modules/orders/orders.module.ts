import { Module } from '@nestjs/common';
import { OrderService } from './services/order.service';
import { OrderTransitionService } from './services/order-transition.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';

@Module({
  imports: [PrismaModule, CartModule, OutboundMessageModule],
  providers: [OrderService, OrderTransitionService],
  exports: [OrderService, OrderTransitionService],
})
export class OrdersModule {}
