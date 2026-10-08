import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationState } from '../constants/conversation-state.enum';
import { ConversationStatus } from '@prisma/client';

export type GlobalCommandType = 'MENU' | 'CANCEL' | 'AGENT' | 'STOP' | 'NONE';

@Injectable()
export class GlobalCommandHandler {
  private readonly logger = new Logger(GlobalCommandHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: ConversationStateService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  detectCommand(text: string): GlobalCommandType {
    const normalized = text.trim().toLowerCase();

    if (
      normalized === 'stop' ||
      normalized === 'unsubscribe' ||
      normalized === 'optout' ||
      normalized === 'opt out'
    ) {
      return 'STOP';
    }

    if (
      normalized === 'menu' ||
      normalized === 'main menu' ||
      normalized === 'home' ||
      normalized === 'start' ||
      normalized === 'hi' ||
      normalized === 'hello'
    ) {
      return 'MENU';
    }

    if (normalized === 'cancel' || normalized === 'abort' || normalized === 'exit') {
      return 'CANCEL';
    }

    if (
      normalized === 'agent' ||
      normalized === 'human' ||
      normalized === 'human agent' ||
      normalized === 'staff' ||
      normalized === 'support' ||
      normalized === 'representative' ||
      normalized.includes('talk to staff') ||
      normalized.includes('talk to human') ||
      normalized.includes('talk to agent') ||
      normalized.includes('speak to human') ||
      normalized.includes('speak with agent')
    ) {
      return 'AGENT';
    }

    return 'NONE';
  }

  async handleStop(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    this.logger.log(`Handling STOP command for customer=${customerId}`);

    // 1. Mark customer as opted out in DB
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        isOptedOut: true,
        optedOutAt: new Date(),
      },
    });

    // 2. Create OptOutRecord
    await this.prisma.optOutRecord.upsert({
      where: {
        businessId_phoneNumber: {
          businessId,
          phoneNumber: customerPhone,
        },
      },
      update: {
        reason: 'STOP',
        createdAt: new Date(),
      },
      create: {
        businessId,
        phoneNumber: customerPhone,
        reason: 'STOP',
      },
    });

    // 3. Clear session state
    await this.stateService.clearState(businessId, customerId);

    // 4. Send confirmation
    await this.outboundService.sendText(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      'You have successfully unsubscribed and opted out of automated messages. Send "START" if you wish to re-subscribe in the future.',
    );
  }

  async handleAgentHandoff(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    this.logger.log(`Transferring conversation=${conversationId} to HUMAN_HANDLING`);

    // 1. Update conversation status in DB
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.HUMAN_HANDLING,
      },
    });

    // 2. Update state in Redis
    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.HUMAN_HANDLING,
    );

    // 3. Send handoff confirmation to customer
    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      '🤝 You have been transferred to our human support team. A representative will review your messages and respond shortly.',
      [
        { id: 'btn_menu', title: 'Main Menu' },
      ],
      {
        footerText: 'Send "menu" anytime to return to bot',
      },
    );
  }

  async handleCancel(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    this.logger.log(`Handling CANCEL command for customer=${customerId}`);

    // Clear active temporary workflow state in Redis
    await this.stateService.setState(businessId, customerId, ConversationState.MAIN_MENU, {});

    await this.outboundService.sendText(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      '❌ Current action cancelled. Returning you to the main menu.',
    );
  }
}
