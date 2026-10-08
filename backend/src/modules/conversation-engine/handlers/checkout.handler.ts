import { Injectable, Logger } from '@nestjs/common';
import { OrderService } from '../../orders/services/order.service';
import { CartService } from '../../cart/services/cart.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { ConversationState } from '../constants/conversation-state.enum';

@Injectable()
export class CheckoutHandler {
  private readonly logger = new Logger(CheckoutHandler.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    private readonly stateService: ConversationStateService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async handleCheckout(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    notes?: string,
  ): Promise<void> {
    const cart = await this.cartService.getCart(businessId, customerId);

    if (cart.items.length === 0) {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        'Your cart is empty. Please add items before checking out.',
        [{ id: 'btn_catalog', title: '🛍️ Browse Catalog' }],
      );
      return;
    }

    // 1. Create order in PostgreSQL
    const order = await this.orderService.createOrderFromCart(
      businessId,
      customerId,
      conversationId,
      notes,
    );

    // 2. Set State in Redis
    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.AWAITING_PAYMENT,
      { activeOrderId: order.id },
    );

    const shortId = order.id.slice(-6).toUpperCase();
    const formattedAmount = `${order.currency} ${Number(order.totalAmount).toLocaleString()}`;

    const confirmationText = `🎉 *Order Placed Successfully!*\n\n📋 *Order ID:* #${shortId}\n💰 *Total Amount:* ${formattedAmount}\n📊 *Status:* PENDING PAYMENT\n\nYour order has been recorded. Complete payment to finalize processing.`;

    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      confirmationText,
      [
        { id: `pay_${order.id}`, title: '💳 Pay Now' },
        { id: 'btn_menu', title: '🏠 Main Menu' },
      ],
      {
        footerText: 'Payment link will be generated',
      },
    );
  }
}
