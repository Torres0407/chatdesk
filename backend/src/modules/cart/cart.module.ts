import { Module } from '@nestjs/common';
import { CartService } from './services/cart.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { ConversationStateService } from '../conversation-engine/services/conversation-state.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [CartService, ConversationStateService],
  exports: [CartService],
})
export class CartModule {}
