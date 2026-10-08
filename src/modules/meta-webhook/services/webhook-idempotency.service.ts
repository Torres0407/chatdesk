import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class WebhookIdempotencyService {
  private readonly logger = new Logger(WebhookIdempotencyService.name);
  private readonly IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Checks whether the inbound WhatsApp message has already been processed.
   * Uses fast Redis NX key with 24h TTL followed by Prisma unique constraint.
   * Returns `true` if the message is NEW and should be processed.
   * Returns `false` if the message is a DUPLICATE and should be ignored.
   */
  async acquireInboundLock(businessId: string, waMessageId: string): Promise<boolean> {
    if (!waMessageId || !businessId) {
      return false;
    }

    const redisKey = `idempotency:inbound:${businessId}:${waMessageId}`;

    // 1. Check & set in Redis with 24h TTL
    try {
      const isNewInRedis = await this.redis.setNx(
        redisKey,
        new Date().toISOString(),
        this.IDEMPOTENCY_TTL_SECONDS,
      );

      if (!isNewInRedis) {
        this.logger.debug(`Duplicate inbound message detected in Redis: ${waMessageId}`);
        return false;
      }
    } catch (err: any) {
      this.logger.warn(`Redis idempotency check warning: ${err.message}`);
    }

    // 2. Persist in database unique constraint
    try {
      await this.prisma.inboundIdempotency.create({
        data: {
          businessId,
          waMessageId,
        },
      });
      return true;
    } catch (err: any) {
      // Prisma unique constraint violation code is P2002
      if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
        this.logger.debug(`Duplicate inbound message detected in DB constraint: ${waMessageId}`);
        return false;
      }
      this.logger.error(`Error recording inbound idempotency record: ${err.message}`);
      // If DB error is not a unique violation, return true to avoid dropping legitimate customer messages
      return true;
    }
  }
}
