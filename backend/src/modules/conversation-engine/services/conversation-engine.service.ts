import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationStateService } from './conversation-state.service';
import { GlobalCommandHandler } from '../handlers/global-command.handler';
import { MenuHandler } from '../handlers/menu.handler';
import { FaqHandler } from '../handlers/faq.handler';
import { CatalogHandler } from '../handlers/catalog.handler';
import { CartHandler } from '../handlers/cart.handler';
import { CheckoutHandler } from '../handlers/checkout.handler';
import { ConversationState } from '../constants/conversation-state.enum';
import { ConversationStatus } from '@prisma/client';
import { MetaInboundMessage } from '../../meta-webhook/dto/meta-webhook.dto';

@Injectable()
export class ConversationEngineService {
  private readonly logger = new Logger(ConversationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: ConversationStateService,
    private readonly globalCommandHandler: GlobalCommandHandler,
    private readonly menuHandler: MenuHandler,
    private readonly faqHandler: FaqHandler,
    private readonly catalogHandler: CatalogHandler,
    private readonly cartHandler: CartHandler,
    private readonly checkoutHandler: CheckoutHandler,
  ) {}

  async processInboundMessage(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    message: MetaInboundMessage,
  ): Promise<void> {
    const textContent = this.extractMessageText(message);
    const buttonOrListId = this.extractInteractiveId(message);
    const commandText = buttonOrListId || textContent;

    this.logger.debug(
      `Processing message for customer=${customerId} conv=${conversationId} commandText="${commandText}"`,
    );

    // 1. Check if customer is opted out
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (customer?.isOptedOut) {
      if (textContent.trim().toUpperCase() === 'START') {
        // Opt back in
        await this.prisma.customer.update({
          where: { id: customerId },
          data: { isOptedOut: false, optedOutAt: null },
        });
        await this.prisma.optOutRecord.deleteMany({
          where: { businessId, phoneNumber: customerPhone },
        });
        await this.menuHandler.sendMainMenu(
          businessId,
          conversationId,
          customerId,
          customerPhone,
        );
      }
      return;
    }

    // 2. Universal Global Command Check ("menu", "cancel", "agent", "stop")
    const globalCmd = this.globalCommandHandler.detectCommand(commandText);

    if (globalCmd === 'STOP') {
      await this.globalCommandHandler.handleStop(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    // 3. Check Conversation Status (HUMAN_HANDLING)
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (conversation?.status === ConversationStatus.HUMAN_HANDLING) {
      if (globalCmd === 'MENU' || buttonOrListId === 'btn_menu') {
        // Customer manually requested to return to bot
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { status: ConversationStatus.BOT },
        });
        await this.menuHandler.sendMainMenu(
          businessId,
          conversationId,
          customerId,
          customerPhone,
        );
        return;
      }
      // In HUMAN_HANDLING mode: Do not auto reply
      this.logger.debug(
        `Conversation ${conversationId} is in HUMAN_HANDLING. Suppressing bot auto-reply.`,
      );
      return;
    }

    if (globalCmd === 'AGENT' || buttonOrListId === 'btn_agent' || buttonOrListId === 'menu_agent') {
      await this.globalCommandHandler.handleAgentHandoff(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    if (globalCmd === 'CANCEL') {
      await this.globalCommandHandler.handleCancel(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      await this.menuHandler.sendMainMenu(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    if (globalCmd === 'MENU' || buttonOrListId === 'btn_menu') {
      await this.menuHandler.sendMainMenu(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    // 4. Catalog, Cart, and Checkout Actions
    if (buttonOrListId === 'btn_catalog' || buttonOrListId === 'menu_catalog' || commandText.toLowerCase() === 'catalog') {
      await this.catalogHandler.showCatalog(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    if (buttonOrListId?.startsWith('prod_')) {
      await this.catalogHandler.showProductDetails(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        buttonOrListId,
      );
      return;
    }

    if (buttonOrListId?.startsWith('add_')) {
      await this.cartHandler.handleAddToCart(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        buttonOrListId,
      );
      return;
    }

    if (buttonOrListId === 'btn_cart' || buttonOrListId === 'menu_cart' || commandText.toLowerCase() === 'cart') {
      await this.cartHandler.showCart(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    if (buttonOrListId === 'btn_clear_cart') {
      await this.cartHandler.handleClearCart(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    if (buttonOrListId === 'btn_checkout' || commandText.toLowerCase() === 'checkout') {
      await this.checkoutHandler.handleCheckout(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    // 5. FAQ Actions
    if (buttonOrListId === 'btn_faq' || buttonOrListId === 'menu_faq' || commandText.toLowerCase() === 'faq') {
      await this.faqHandler.showFaqList(
        businessId,
        conversationId,
        customerId,
        customerPhone,
      );
      return;
    }

    if (buttonOrListId?.startsWith('faq_')) {
      await this.faqHandler.handleFaqSelection(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        buttonOrListId,
      );
      return;
    }

    // 6. State Machine Routing
    const session = await this.stateService.getState(businessId, customerId);

    switch (session.state) {
      case ConversationState.BROWSING_CATALOG: {
        await this.catalogHandler.showCatalog(
          businessId,
          conversationId,
          customerId,
          customerPhone,
        );
        break;
      }

      case ConversationState.CART: {
        await this.cartHandler.showCart(
          businessId,
          conversationId,
          customerId,
          customerPhone,
        );
        break;
      }

      case ConversationState.MAIN_MENU: {
        // Try matching text against FAQ
        if (textContent) {
          const faqMatched = await this.faqHandler.searchAndAnswerFaq(
            businessId,
            conversationId,
            customerId,
            customerPhone,
            textContent,
          );
          if (faqMatched) return;
        }

        // Default fallback in MAIN_MENU: show main menu
        await this.menuHandler.sendMainMenu(
          businessId,
          conversationId,
          customerId,
          customerPhone,
        );
        break;
      }

      default: {
        await this.menuHandler.sendMainMenu(
          businessId,
          conversationId,
          customerId,
          customerPhone,
        );
        break;
      }
    }
  }

  private extractMessageText(message: MetaInboundMessage): string {
    if (message.type === 'text' && message.text?.body) {
      return message.text.body;
    }
    if (message.type === 'interactive') {
      if (message.interactive?.button_reply?.title) {
        return message.interactive.button_reply.title;
      }
      if (message.interactive?.list_reply?.title) {
        return message.interactive.list_reply.title;
      }
    }
    return '';
  }

  private extractInteractiveId(message: MetaInboundMessage): string | null {
    if (message.type === 'interactive') {
      if (message.interactive?.button_reply?.id) {
        return message.interactive.button_reply.id;
      }
      if (message.interactive?.list_reply?.id) {
        return message.interactive.list_reply.id;
      }
    }
    return null;
  }
}
