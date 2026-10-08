import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationState } from '../constants/conversation-state.enum';

@Injectable()
export class MenuHandler {
  private readonly logger = new Logger(MenuHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: ConversationStateService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async sendMainMenu(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    // 1. Fetch Business & BusinessSettings
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { settings: true },
    });

    const businessName = business?.name || 'our shop';
    const settings = business?.settings;
    const welcomeText =
      settings?.welcomeMessage ||
      `👋 Welcome to *${businessName}*! How can we assist you today?`;

    // 2. Set State in Redis to MAIN_MENU
    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.MAIN_MENU,
      {},
    );

    // 3. Build Interactive Options
    const buttons: Array<{ id: string; title: string }> = [];

    if (settings?.catalogEnabled !== false) {
      buttons.push({ id: 'btn_catalog', title: '🛍️ Catalog & Order' });
    }
    if (settings?.bookingsEnabled !== false) {
      buttons.push({ id: 'btn_booking', title: '📅 Book Service' });
    }
    if (settings?.faqEnabled !== false) {
      buttons.push({ id: 'btn_faq', title: '❓ FAQs & Info' });
    }

    // WhatsApp buttons limit is 3. If we have <= 3 options, use buttons. If more, use interactive list.
    if (buttons.length <= 3) {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        welcomeText,
        buttons,
        {
          headerText: businessName,
          footerText: 'Reply with button or type "agent" for help',
        },
      );
    } else {
      const rows = [
        ...(settings?.catalogEnabled !== false
          ? [{ id: 'menu_catalog', title: '🛍️ Browse Catalog', description: 'Explore items and place orders' }]
          : []),
        ...(settings?.bookingsEnabled !== false
          ? [{ id: 'menu_booking', title: '📅 Book an Appointment', description: 'Schedule a service booking' }]
          : []),
        ...(settings?.faqEnabled !== false
          ? [{ id: 'menu_faq', title: '❓ Frequently Asked Questions', description: 'Get quick answers to common questions' }]
          : []),
        { id: 'menu_agent', title: '👤 Speak with Agent', description: 'Connect with a live customer representative' },
      ];

      await this.outboundService.sendList(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        welcomeText,
        'Select Option',
        [{ title: 'Main Options', rows }],
        {
          headerText: businessName,
          footerText: 'Type "agent" anytime for human support',
        },
      );
    }
  }
}
