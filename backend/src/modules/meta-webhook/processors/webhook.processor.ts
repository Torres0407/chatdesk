import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  META_WEBHOOK_QUEUE,
  JOB_PROCESS_WEBHOOK_ENTRY,
} from '../constants/webhook.constants';
import {
  MetaWebhookPayload,
  MetaInboundMessage,
  MetaStatusUpdate,
} from '../dto/meta-webhook.dto';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';
import { maskPhoneNumber } from '../../../common/utils/phone-mask.util';
import { MessageStatus } from '@prisma/client';
import { ConversationEngineService } from '../../conversation-engine/services/conversation-engine.service';

@Processor(META_WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: WebhookIdempotencyService,
    private readonly conversationEngine: ConversationEngineService,
  ) {
    super();
  }

  async process(job: Job<{ payload: MetaWebhookPayload; receivedAt: string }>): Promise<any> {
    if (job.name !== JOB_PROCESS_WEBHOOK_ENTRY) {
      return;
    }

    const payload = job.data?.payload;
    if (!payload?.entry) {
      return { processed: 0 };
    }

    let processedCount = 0;

    for (const entry of payload.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) {
          this.logger.warn('Received webhook without phone_number_id');
          continue;
        }

        // 1. Resolve multi-tenant business by Meta Phone Number ID
        const business = await this.prisma.business.findUnique({
          where: { phoneNumberId },
        });

        if (!business) {
          this.logger.warn(`No business registered for Meta phone_number_id: ${phoneNumberId}`);
          continue;
        }

        // 2. Process Inbound Messages
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            const handled = await this.handleInboundMessage(business.id, message, value.contacts);
            if (handled) processedCount++;
          }
        }

        // 3. Process Outbound Message Status Updates (sent, delivered, read, failed)
        if (value.statuses && value.statuses.length > 0) {
          for (const statusUpdate of value.statuses) {
            await this.handleStatusUpdate(business.id, statusUpdate);
            processedCount++;
          }
        }
      }
    }

    return { processed: processedCount };
  }

  private async handleInboundMessage(
    businessId: string,
    message: MetaInboundMessage,
    contacts?: any[],
  ): Promise<boolean> {
    const maskedSender = maskPhoneNumber(message.from);
    this.logger.log(
      `Received inbound message id=${message.id} type=${message.type} from=${maskedSender} for business=${businessId}`,
    );

    // Idempotency check: Redis TTL + DB constraint
    const isNew = await this.idempotencyService.acquireInboundLock(businessId, message.id);
    if (!isNew) {
      this.logger.debug(`Skipping already processed message id=${message.id}`);
      return false;
    }

    // Customer resolution / upsert
    const customerPhone = message.from.startsWith('+') ? message.from : `+${message.from}`;
    const profileName = contacts?.[0]?.profile?.name || null;

    const customer = await this.prisma.customer.upsert({
      where: {
        businessId_phoneNumber: {
          businessId,
          phoneNumber: customerPhone,
        },
      },
      update: {
        ...(profileName ? { name: profileName } : {}),
      },
      create: {
        businessId,
        phoneNumber: customerPhone,
        name: profileName,
      },
    });

    // Check opt-out status
    if (customer.isOptedOut) {
      this.logger.log(`Customer ${maskedSender} is opted-out. Discarding message.`);
      return false;
    }

    // Upsert or fetch Active Conversation
    const conversation = await this.prisma.conversation.upsert({
      where: {
        id: (
          await this.prisma.conversation.findFirst({
            where: {
              businessId,
              customerId: customer.id,
              status: { in: ['BOT', 'HUMAN_HANDLING'] },
            },
            select: { id: true },
          })
        )?.id || 'non-existent-id',
      },
      update: {
        lastCustomerMessageAt: new Date(),
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hr Meta customer care window
      },
      create: {
        businessId,
        customerId: customer.id,
        status: 'BOT',
        lastCustomerMessageAt: new Date(),
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Persist inbound message record
    await this.prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        waMessageId: message.id,
        direction: 'INBOUND',
        type: this.mapMessageType(message.type),
        content: message as any,
        status: MessageStatus.RECEIVED,
      },
    });

    // Downstream state machine processor triggered
    await this.conversationEngine.processInboundMessage(
      businessId,
      conversation.id,
      customer.id,
      customer.phoneNumber,
      message,
    );

    return true;
  }

  private async handleStatusUpdate(
    businessId: string,
    statusUpdate: MetaStatusUpdate,
  ): Promise<void> {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };

    const newStatus = statusMap[statusUpdate.status];
    if (!newStatus) return;

    try {
      await this.prisma.message.updateMany({
        where: {
          businessId,
          waMessageId: statusUpdate.id,
        },
        data: {
          status: newStatus,
        },
      });
      this.logger.debug(`Updated message ${statusUpdate.id} status to ${newStatus}`);
    } catch (err: any) {
      this.logger.warn(`Failed to update message status for ${statusUpdate.id}: ${err.message}`);
    }
  }

  private mapMessageType(type: string): any {
    switch (type) {
      case 'interactive':
        return 'INTERACTIVE_BUTTON';
      case 'image':
        return 'IMAGE';
      default:
        return 'TEXT';
    }
  }
}
