import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  OUTBOUND_MESSAGE_QUEUE,
  JOB_SEND_OUTBOUND_MESSAGE,
} from '../constants/outbound.constants';
import { EnqueueOutboundJobData } from '../dto/outbound-message.dto';
import { MetaApiClientService } from '../services/meta-api-client.service';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { maskPhoneNumber } from '../../../common/utils/phone-mask.util';

@Processor(OUTBOUND_MESSAGE_QUEUE)
export class OutboundMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboundMessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaApiClient: MetaApiClientService,
  ) {
    super();
  }

  async process(job: Job<EnqueueOutboundJobData>): Promise<any> {
    if (job.name !== JOB_SEND_OUTBOUND_MESSAGE) {
      return;
    }

    const {
      businessId,
      conversationId,
      customerId,
      toPhoneNumber,
      payload,
      bypass24HourWindow,
      staffUserId,
    } = job.data;

    const maskedPhone = maskPhoneNumber(toPhoneNumber);

    // 1. Check if customer is opted out
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { isOptedOut: true },
    });

    if (customer?.isOptedOut) {
      this.logger.warn(`Customer ${maskedPhone} is opted-out. Aborting outbound message.`);
      return { skipped: 'opted_out' };
    }

    // 2. Validate 24-hour customer service window
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { windowExpiresAt: true },
    });

    const isWindowExpired =
      conversation?.windowExpiresAt &&
      new Date(conversation.windowExpiresAt).getTime() < Date.now();

    if (isWindowExpired && !bypass24HourWindow && payload.type !== 'template') {
      const errMsg = `Cannot send freeform message to ${maskedPhone}: 24-hour Meta window has expired. WhatsApp requires an approved template message.`;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }

    // 3. Resolve Business credentials
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { phoneNumberId: true, accessToken: true },
    });

    if (!business?.phoneNumberId) {
      throw new Error(`Business ${businessId} has no Meta phoneNumberId configured.`);
    }

    const accessToken = business.accessToken || process.env.META_API_ACCESS_TOKEN || 'mock_token';

    // 4. Send message through Meta Graph API
    const metaResponse = await this.metaApiClient.sendMessage(
      business.phoneNumberId,
      accessToken,
      payload,
    );

    const waMessageId = metaResponse?.messages?.[0]?.id || null;

    // 5. Persist Outbound Message in Database
    const messageType = this.mapPayloadTypeToMessageType(payload.type);

    await this.prisma.message.create({
      data: {
        businessId,
        conversationId,
        waMessageId,
        direction: MessageDirection.OUTBOUND,
        type: messageType,
        content: payload as any,
        status: MessageStatus.SENT,
        staffUserId: staffUserId || null,
      },
    });

    // Update conversation lastBotMessageAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastBotMessageAt: new Date() },
    });

    this.logger.log(
      `Outbound message sent successfully to ${maskedPhone} waMessageId=${waMessageId}`,
    );

    return { success: true, waMessageId };
  }

  private mapPayloadTypeToMessageType(type: string): MessageType {
    switch (type) {
      case 'interactive':
        return MessageType.INTERACTIVE_BUTTON;
      case 'image':
        return MessageType.IMAGE;
      case 'template':
        return MessageType.TEMPLATE;
      default:
        return MessageType.TEXT;
    }
  }
}
