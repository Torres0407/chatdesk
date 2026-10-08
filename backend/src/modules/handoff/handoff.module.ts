import { Module, forwardRef } from '@nestjs/common';
import { HandoffService } from './services/handoff.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';
import { ConversationEngineModule } from '../conversation-engine/conversation-engine.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    OutboundMessageModule,
    forwardRef(() => ConversationEngineModule),
  ],
  providers: [HandoffService],
  exports: [HandoffService],
})
export class HandoffModule {}
