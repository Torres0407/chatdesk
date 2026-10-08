import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationManagementService } from './services/conversation-management.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, OutboundMessageModule, AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationManagementService],
  exports: [ConversationManagementService],
})
export class ConversationsModule {}
