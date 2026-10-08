import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OUTBOUND_MESSAGE_QUEUE } from './constants/outbound.constants';
import { OutboundMessageService } from './services/outbound-message.service';
import { OutboundMessageProcessor } from './processors/outbound-message.processor';
import { MetaApiClientService } from './services/meta-api-client.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: OUTBOUND_MESSAGE_QUEUE,
    }),
    PrismaModule,
  ],
  providers: [
    OutboundMessageService,
    OutboundMessageProcessor,
    MetaApiClientService,
  ],
  exports: [OutboundMessageService, MetaApiClientService],
})
export class OutboundMessageModule {}
