import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import {
  ConversationState,
  ConversationSessionContext,
} from '../constants/conversation-state.enum';

@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);
  private readonly DEFAULT_TTL_SECONDS = 86400; // 24 hours

  constructor(private readonly redis: RedisService) {}

  private getSessionKey(businessId: string, customerId: string): string {
    return `session:${businessId}:${customerId}`;
  }

  async getState(
    businessId: string,
    customerId: string,
  ): Promise<ConversationSessionContext> {
    const key = this.getSessionKey(businessId, customerId);
    const raw = await this.redis.get(key);

    if (!raw) {
      return {
        state: ConversationState.MAIN_MENU,
        metadata: {},
        updatedAt: Date.now(),
      };
    }

    try {
      const parsed = JSON.parse(raw) as ConversationSessionContext;
      return parsed;
    } catch {
      return {
        state: ConversationState.MAIN_MENU,
        metadata: {},
        updatedAt: Date.now(),
      };
    }
  }

  async setState(
    businessId: string,
    customerId: string,
    state: ConversationState,
    metadata: Record<string, any> = {},
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const key = this.getSessionKey(businessId, customerId);
    const context: ConversationSessionContext = {
      state,
      metadata,
      updatedAt: Date.now(),
    };

    await this.redis.set(key, JSON.stringify(context), ttlSeconds);
    this.logger.debug(
      `Set state for customer=${customerId} business=${businessId} to state=${state}`,
    );
  }

  async updateMetadata(
    businessId: string,
    customerId: string,
    partialMetadata: Record<string, any>,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS,
  ): Promise<ConversationSessionContext> {
    const current = await this.getState(businessId, customerId);
    const updated: ConversationSessionContext = {
      ...current,
      metadata: {
        ...(current.metadata || {}),
        ...partialMetadata,
      },
      updatedAt: Date.now(),
    };

    const key = this.getSessionKey(businessId, customerId);
    await this.redis.set(key, JSON.stringify(updated), ttlSeconds);
    return updated;
  }

  async clearState(businessId: string, customerId: string): Promise<void> {
    const key = this.getSessionKey(businessId, customerId);
    await this.redis.del(key);
  }
}
