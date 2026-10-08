import { Module } from '@nestjs/common';
import { ConversationStateService } from './services/conversation-state.service';
import { ConversationEngineService } from './services/conversation-engine.service';
import { GlobalCommandHandler } from './handlers/global-command.handler';
import { MenuHandler } from './handlers/menu.handler';
import { FaqHandler } from './handlers/faq.handler';
import { CatalogHandler } from './handlers/catalog.handler';
import { CartHandler } from './handlers/cart.handler';
import { CheckoutHandler } from './handlers/checkout.handler';
import { BookingHandler } from './handlers/booking.handler';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { forwardRef } from '@nestjs/common';
import { HandoffModule } from '../handoff/handoff.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    OutboundMessageModule,
    CartModule,
    OrdersModule,
    BookingsModule,
    PaymentsModule,
    AiModule,
    forwardRef(() => HandoffModule),
  ],
  providers: [
    ConversationStateService,
    ConversationEngineService,
    GlobalCommandHandler,
    MenuHandler,
    FaqHandler,
    CatalogHandler,
    CartHandler,
    CheckoutHandler,
    BookingHandler,
  ],
  exports: [
    ConversationStateService,
    ConversationEngineService,
    GlobalCommandHandler,
    MenuHandler,
    FaqHandler,
    CatalogHandler,
    CartHandler,
    CheckoutHandler,
    BookingHandler,
  ],
})
export class ConversationEngineModule {}
