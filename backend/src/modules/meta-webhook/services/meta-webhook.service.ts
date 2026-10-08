import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  META_WEBHOOK_QUEUE,
  JOB_PROCESS_WEBHOOK_ENTRY,
} from '../constants/webhook.constants';
import {
  MetaWebhookPayload,
  MetaWebhookVerifyQueryDto,
} from '../dto/meta-webhook.dto';

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(META_WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  /**
   * Handles Meta WhatsApp webhook GET verification handshake.
   */
  verifyWebhook(query: MetaWebhookVerifyQueryDto): string {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken = this.configService.get<string>('META_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === expectedToken) {
      this.logger.log('Meta webhook verification handshake succeeded');
      return challenge;
    }

    this.logger.warn(`Meta webhook verification failed. Received token: ${token}`);
    throw new ForbiddenException('Invalid verification token');
  }

  /**
   * Accepts Meta webhook POST payload, quickly pushes into BullMQ queue,
   * and returns fast 200 OK.
   */
  async enqueuePayload(payload: MetaWebhookPayload): Promise<{ status: string; received: boolean }> {
    if (!payload || !payload.entry || payload.entry.length === 0) {
      return { status: 'ignored', received: true };
    }

    try {
      await this.webhookQueue.add(
        JOB_PROCESS_WEBHOOK_ENTRY,
        {
          payload,
          receivedAt: new Date().toISOString(),
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      return { status: 'queued', received: true };
    } catch (err: any) {
      this.logger.error(`Failed to enqueue webhook payload: ${err.message}`, err.stack);
      // Still return received true so Meta doesn't aggressively hammer retries on transient queue errors
      return { status: 'error_queued', received: true };
    }
  }
}
