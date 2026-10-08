import { Module } from '@nestjs/common';
import { ConversationStateService } from './services/conversation-state.service';
import { ConversationEngineService } from './services/conversation-engine.service';
import { GlobalCommandHandler } from './handlers/global-command.handler';
import { MenuHandler } from './handlers/menu.handler';
import { FaqHandler } from './handlers/faq.handler';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule, OutboundMessageModule],
  providers: [
    ConversationStateService,
    ConversationEngineService,
    GlobalCommandHandler,
    MenuHandler,
    FaqHandler,
  ],
  exports: [
    ConversationStateService,
    ConversationEngineService,
    GlobalCommandHandler,
    MenuHandler,
    FaqHandler,
  ],
})
export class ConversationEngineModule {}
