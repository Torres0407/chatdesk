import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { ConversationState } from '../constants/conversation-state.enum';

@Injectable()
export class FaqHandler {
  private readonly logger = new Logger(FaqHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: ConversationStateService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async showFaqList(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    const faqs = await this.prisma.faq.findMany({
      where: {
        businessId,
        isActive: true,
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    if (faqs.length === 0) {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        'No FAQs are currently listed for this shop. Feel free to connect with our support staff or return to the menu.',
        [
          { id: 'btn_menu', title: 'Main Menu' },
          { id: 'btn_agent', title: 'Talk to Agent' },
        ],
      );
      return;
    }

    if (faqs.length <= 3) {
      const buttons = faqs.map((f, i) => ({
        id: `faq_${f.id}`,
        title: f.question.length > 20 ? `${f.question.substring(0, 17)}...` : f.question,
      }));

      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        'Here are some common questions. Select one or type your question:',
        buttons,
        {
          footerText: 'Type "menu" to return',
        },
      );
    } else {
      const rows = faqs.map((f) => ({
        id: `faq_${f.id}`,
        title: f.question.length > 24 ? `${f.question.substring(0, 21)}...` : f.question,
        description: f.answer.length > 72 ? `${f.answer.substring(0, 69)}...` : f.answer,
      }));

      await this.outboundService.sendList(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        '📚 *Frequently Asked Questions*\nSelect a question below or type your inquiry:',
        'View Questions',
        [{ title: 'Top FAQs', rows }],
        {
          footerText: 'Type "menu" to return',
        },
      );
    }
  }

  async handleFaqSelection(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    faqId: string,
  ): Promise<void> {
    const cleanId = faqId.replace(/^faq_/, '');
    const faq = await this.prisma.faq.findFirst({
      where: {
        id: cleanId,
        businessId,
        isActive: true,
      },
    });

    if (!faq) {
      await this.showFaqList(businessId, conversationId, customerId, customerPhone);
      return;
    }

    const bodyText = `❓ *${faq.question}*\n\n${faq.answer}`;

    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      bodyText,
      [
        { id: 'btn_faq', title: 'More FAQs' },
        { id: 'btn_menu', title: 'Main Menu' },
      ],
      {
        footerText: 'Chatdesk Business Assistant',
      },
    );
  }

  async searchAndAnswerFaq(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    query: string,
  ): Promise<boolean> {
    const normalizedQuery = query.toLowerCase().trim();

    // 1. Fetch all active FAQs for this tenant
    const faqs = await this.prisma.faq.findMany({
      where: {
        businessId,
        isActive: true,
      },
    });

    if (faqs.length === 0) return false;

    // 2. Simple keyword and question substring matching
    let bestMatch = faqs.find((faq) => {
      const q = faq.question.toLowerCase();
      if (q.includes(normalizedQuery) || normalizedQuery.includes(q)) return true;

      // Match keyword array
      if (faq.keywords && Array.isArray(faq.keywords)) {
        return faq.keywords.some((kw) =>
          normalizedQuery.includes(kw.toLowerCase()),
        );
      }
      return false;
    });

    if (!bestMatch) {
      // Check for partial word overlap
      const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 3);
      bestMatch = faqs.find((faq) => {
        const text = `${faq.question} ${faq.keywords?.join(' ') || ''}`.toLowerCase();
        return queryWords.some((w) => text.includes(w));
      });
    }

    if (bestMatch) {
      await this.handleFaqSelection(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        bestMatch.id,
      );
      return true;
    }

    return false;
  }
}
