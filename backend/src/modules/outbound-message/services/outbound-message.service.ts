import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OUTBOUND_MESSAGE_QUEUE,
  JOB_SEND_OUTBOUND_MESSAGE,
} from '../constants/outbound.constants';
import {
  EnqueueOutboundJobData,
  SendWhatsAppMessageDto,
} from '../dto/outbound-message.dto';
import { MessageBuilder } from '../builder/message.builder';

@Injectable()
export class OutboundMessageService {
  private readonly logger = new Logger(OutboundMessageService.name);

  constructor(
    @InjectQueue(OUTBOUND_MESSAGE_QUEUE)
    private readonly outboundQueue: Queue<EnqueueOutboundJobData>,
  ) {}

  async enqueueMessage(jobData: EnqueueOutboundJobData): Promise<void> {
    await this.outboundQueue.add(JOB_SEND_OUTBOUND_MESSAGE, jobData, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s, 16s, 32s
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.debug(
      `Enqueued outbound message type=${jobData.payload.type} to=${jobData.toPhoneNumber} for business=${jobData.businessId}`,
    );
  }

  async sendText(
    businessId: string,
    conversationId: string,
    customerId: string,
    toPhoneNumber: string,
    body: string,
    staffUserId?: string,
  ): Promise<void> {
    const payload = MessageBuilder.text(toPhoneNumber, body);
    await this.enqueueMessage({
      businessId,
      conversationId,
      customerId,
      toPhoneNumber,
      payload,
      staffUserId,
    });
  }

  async sendButtons(
    businessId: string,
    conversationId: string,
    customerId: string,
    toPhoneNumber: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    options?: { headerText?: string; footerText?: string },
    staffUserId?: string,
  ): Promise<void> {
    const payload = MessageBuilder.buttons(toPhoneNumber, bodyText, buttons, options);
    await this.enqueueMessage({
      businessId,
      conversationId,
      customerId,
      toPhoneNumber,
      payload,
      staffUserId,
    });
  }

  async sendList(
    businessId: string,
    conversationId: string,
    customerId: string,
    toPhoneNumber: string,
    bodyText: string,
    buttonLabel: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    options?: { headerText?: string; footerText?: string },
    staffUserId?: string,
  ): Promise<void> {
    const payload = MessageBuilder.list(
      toPhoneNumber,
      bodyText,
      buttonLabel,
      sections,
      options,
    );
    await this.enqueueMessage({
      businessId,
      conversationId,
      customerId,
      toPhoneNumber,
      payload,
      staffUserId,
    });
  }
}
