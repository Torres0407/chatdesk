import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { EventBusService } from '../../events/services/event-bus.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationStateService } from '../../conversation-engine/services/conversation-state.service';
import { ConversationState } from '../../conversation-engine/constants/conversation-state.enum';
import { ConversationStatus } from '@prisma/client';
import { HandoffTriggeredData } from '../../events/dto/events.dto';

export interface HandoffDecision {
  shouldHandoff: boolean;
  reason?: 'KEYWORD' | 'BUTTON_CLICK' | 'CONSECUTIVE_FALLBACKS' | 'URGENT_KEYWORD';
  priority?: 'NORMAL' | 'URGENT';
}

@Injectable()
export class HandoffService {
  private readonly logger = new Logger(HandoffService.name);
  private readonly FALLBACK_THRESHOLD = 3;
  private readonly FALLBACK_TTL_SECONDS = 3600; // 1 hour

  private readonly URGENT_KEYWORDS = [
    'fraud',
    'scam',
    'manager',
    'emergency',
    'stolen',
    'lawsuit',
    'refund problem',
    'unauthorized',
    'urgent',
    'critical issue',
    'complaint',
    'police',
  ];

  private readonly AGENT_KEYWORDS = [
    'agent',
    'human',
    'representative',
    'staff',
    'operator',
    'talk to human',
    'talk to agent',
    'talk to staff',
    'talk to person',
    'speak with human',
    'speak with agent',
    'speak to representative',
    'customer service',
    'support person',
    'real person',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventBus: EventBusService,
    private readonly outboundService: OutboundMessageService,
    private readonly stateService: ConversationStateService,
  ) {}

  /**
   * Evaluates inbound message text and interactive IDs against handoff rules.
   */
  async evaluateHandoff(
    businessId: string,
    customerId: string,
    text: string,
    interactiveId?: string | null,
  ): Promise<HandoffDecision> {
    const normalized = text.trim().toLowerCase();

    // 1. Explicit Button / Interactive trigger
    if (interactiveId === 'btn_agent' || interactiveId === 'menu_agent') {
      return {
        shouldHandoff: true,
        reason: 'BUTTON_CLICK',
        priority: 'NORMAL',
      };
    }

    // 2. Urgent / High-priority keywords
    for (const kw of this.URGENT_KEYWORDS) {
      if (normalized.includes(kw)) {
        return {
          shouldHandoff: true,
          reason: 'URGENT_KEYWORD',
          priority: 'URGENT',
        };
      }
    }

    // 3. Explicit Agent keywords
    for (const kw of this.AGENT_KEYWORDS) {
      if (normalized === kw || normalized.includes(kw)) {
        return {
          shouldHandoff: true,
          reason: 'KEYWORD',
          priority: 'NORMAL',
        };
      }
    }

    return { shouldHandoff: false };
  }

  /**
   * Tracks consecutive fallback/unrecognized messages and triggers handoff if threshold is reached.
   */
  async recordFallbackAndCheckThreshold(
    businessId: string,
    customerId: string,
  ): Promise<HandoffDecision> {
    const redisKey = `fallback:count:${businessId}:${customerId}`;
    const raw = await this.redis.get(redisKey);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;

    await this.redis.set(redisKey, count.toString(), this.FALLBACK_TTL_SECONDS);

    if (count >= this.FALLBACK_THRESHOLD) {
      await this.redis.del(redisKey);
      return {
        shouldHandoff: true,
        reason: 'CONSECUTIVE_FALLBACKS',
        priority: 'NORMAL',
      };
    }

    return { shouldHandoff: false };
  }

  /**
   * Resets the consecutive fallback count.
   */
  async resetFallbackCount(businessId: string, customerId: string): Promise<void> {
    const redisKey = `fallback:count:${businessId}:${customerId}`;
    await this.redis.del(redisKey);
  }

  /**
   * Checks if current time is within business operating hours.
   */
  isWithinOperatingHours(settings: any, date: Date = new Date()): boolean {
    if (!settings || !settings.operatingHours) {
      // Default: Always open if no custom operating hours are configured
      return true;
    }

    try {
      const hours = typeof settings.operatingHours === 'string'
        ? JSON.parse(settings.operatingHours)
        : settings.operatingHours;

      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[date.getDay()];
      const daySchedule = hours[currentDay];

      if (!daySchedule || !daySchedule.isOpen) {
        return false;
      }

      const currentMinutes = date.getHours() * 60 + date.getMinutes();
      const [openH, openM] = (daySchedule.open || '09:00').split(':').map(Number);
      const [closeH, closeM] = (daySchedule.close || '18:00').split(':').map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } catch {
      return true;
    }
  }

  /**
   * Executes the handoff: updates DB conversation, Redis state, emits SSE events, and notifies customer.
   */
  async executeHandoff(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    decision: HandoffDecision,
    messageSnippet?: string,
  ): Promise<void> {
    const reason = decision.reason || 'KEYWORD';
    const priority = decision.priority || 'NORMAL';

    this.logger.log(
      `Executing handoff for conv=${conversationId} customer=${customerId} reason=${reason} priority=${priority}`,
    );

    // 1. Fetch business & customer metadata
    const [business, customer] = await Promise.all([
      this.prisma.business.findUnique({
        where: { id: businessId },
        include: { settings: true },
      }),
      this.prisma.customer.findUnique({
        where: { id: customerId },
      }),
    ]);

    const isOutsideHours = business?.settings
      ? !this.isWithinOperatingHours(business.settings)
      : false;

    // 2. Update conversation status in DB
    const updatedConv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.HUMAN_HANDLING,
      },
    });

    // 3. Update conversation state in Redis
    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.HUMAN_HANDLING,
    );

    // 4. Clear any fallback counter
    await this.resetFallbackCount(businessId, customerId);

    // 5. Emit realtime SSE events to staff dashboard
    const handoffData: HandoffTriggeredData = {
      conversationId,
      customerId,
      customerPhone,
      customerName: customer?.name || null,
      reason,
      priority,
      messageSnippet,
      isOutsideOperatingHours: isOutsideHours,
    };

    await this.eventBus.publishEvent('handoff.triggered', businessId, handoffData);
    await this.eventBus.publishEvent('conversation.updated', businessId, {
      conversationId,
      status: ConversationStatus.HUMAN_HANDLING,
      updatedAt: updatedConv.updatedAt,
      priority,
    });

    // 6. Send WhatsApp response to customer
    if (isOutsideHours) {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        `🌙 *We are currently outside our operating hours.*\n\nOur human support team has received your message and will respond as soon as we reopen. Thank you for your patience!`,
        [{ id: 'btn_menu', title: '🏠 Main Menu' }],
        {
          footerText: 'Send "menu" anytime to use automated services',
        },
      );
    } else if (priority === 'URGENT') {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        `🚨 *Urgent Support Request Escalated*\n\nYour request has been prioritized with our senior team. A representative will be with you shortly.`,
        [{ id: 'btn_menu', title: '🏠 Main Menu' }],
        {
          footerText: 'Send "menu" anytime to return to bot',
        },
      );
    } else {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        `🤝 *You have been transferred to our support team.*\n\nA human agent will review your conversation history and reply shortly.`,
        [{ id: 'btn_menu', title: '🏠 Main Menu' }],
        {
          footerText: 'Send "menu" anytime to return to bot',
        },
      );
    }
  }
}
