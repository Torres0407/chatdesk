import { Injectable, Logger } from '@nestjs/common';
import { CartService } from '../../cart/services/cart.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { ConversationState } from '../constants/conversation-state.enum';

@Injectable()
export class CartHandler {
  private readonly logger = new Logger(CartHandler.name);

  constructor(
    private readonly cartService: CartService,
    private readonly stateService: ConversationStateService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async showCart(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    const cart = await this.cartService.getCart(businessId, customerId);

    if (cart.items.length === 0) {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        '🛒 Your cart is currently empty. Explore our catalog to add items!',
        [
          { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
          { id: 'btn_menu', title: '🏠 Main Menu' },
        ],
      );
      return;
    }

    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.CART,
    );

    let itemsList = cart.items
      .map(
        (item, idx) =>
          `${idx + 1}. *${item.name}* x${item.quantity} - ${item.currency} ${(
            item.price * item.quantity
          ).toLocaleString()}`,
      )
      .join('\n');

    const bodyText = `🛒 *Your Shopping Cart*\n\n${itemsList}\n\n━━━━━━━━━━━━━━\n💰 *Total:* ${
      cart.currency
    } ${cart.subtotal.toLocaleString()} (${cart.itemCount} items)`;

    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      bodyText,
      [
        { id: 'btn_checkout', title: '💳 Checkout' },
        { id: 'btn_catalog', title: '➕ Add More' },
        { id: 'btn_clear_cart', title: '🗑️ Clear Cart' },
      ],
      {
        footerText: 'Chatdesk WhatsApp Checkout',
      },
    );
  }

  async handleAddToCart(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    productId: string,
  ): Promise<void> {
    const cleanId = productId.replace(/^add_/, '');
    const updatedCart = await this.cartService.addItem(
      businessId,
      customerId,
      cleanId,
      1,
    );

    const addedItem = updatedCart.items.find((i) => i.productId === cleanId);
    const itemName = addedItem ? addedItem.name : 'Item';

    const confirmationText = `✅ Added *${itemName}* to your cart!\n\n🛒 Cart Total: *${
      updatedCart.currency
    } ${updatedCart.subtotal.toLocaleString()}* (${updatedCart.itemCount} items)`;

    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      confirmationText,
      [
        { id: 'btn_cart', title: '🛍️ View Cart' },
        { id: 'btn_checkout', title: '💳 Checkout' },
        { id: 'btn_catalog', title: '➕ Keep Shopping' },
      ],
    );
  }

  async handleClearCart(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    await this.cartService.clearCart(businessId, customerId);

    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      '🗑️ Your cart has been cleared.',
      [
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_menu', title: '🏠 Main Menu' },
      ],
    );
  }
}
