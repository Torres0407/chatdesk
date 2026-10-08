import { Module } from '@nestjs/common';
import { ConversationStateService } from './services/conversation-state.service';
import { ConversationEngineService } from './services/conversation-engine.service';
import { GlobalCommandHandler } from './handlers/global-command.handler';
import { MenuHandler } from './handlers/menu.handler';
import { FaqHandler } from './handlers/faq.handler';
import { CatalogHandler } from './handlers/catalog.handler';
import { CartHandler } from './handlers/cart.handler';
import { CheckoutHandler } from './handlers/checkout.handler';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    OutboundMessageModule,
    CartModule,
    OrdersModule,
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
  ],
})
export class ConversationEngineModule {}
