import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { META_WEBHOOK_QUEUE, META_OUTBOUND_QUEUE } from './constants/webhook.constants';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './services/meta-webhook.service';
import { WebhookIdempotencyService } from './services/webhook-idempotency.service';
import { WebhookProcessor } from './processors/webhook.processor';
import { MetaSignatureGuard } from './guards/meta-signature.guard';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: META_WEBHOOK_QUEUE,
      },
      {
        name: META_OUTBOUND_QUEUE,
      },
    ),
  ],
  controllers: [MetaWebhookController],
  providers: [
    MetaWebhookService,
    WebhookIdempotencyService,
    WebhookProcessor,
    MetaSignatureGuard,
  ],
  exports: [
    MetaWebhookService,
    WebhookIdempotencyService,
  ],
})
export class MetaWebhookModule {}
