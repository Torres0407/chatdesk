import { Injectable, Logger } from '@nestjs/common';
import { ConversationStateService } from '../../conversation-engine/services/conversation-state.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
  imageUrl?: string | null;
}

export interface CustomerCart {
  items: CartItem[];
  subtotal: number;
  currency: string;
  itemCount: number;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly stateService: ConversationStateService,
    private readonly prisma: PrismaService,
  ) {}

  async getCart(businessId: string, customerId: string): Promise<CustomerCart> {
    const session = await this.stateService.getState(businessId, customerId);
    const items: CartItem[] = session.metadata?.cart?.items || [];
    const currency = items[0]?.currency || 'NGN';

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      subtotal,
      currency,
      itemCount,
    };
  }

  async addItem(
    businessId: string,
    customerId: string,
    productId: string,
    quantity = 1,
  ): Promise<CustomerCart> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
        isActive: true,
      },
    });

    if (!product) {
      throw new Error(`Product ${productId} is not available.`);
    }

    const currentCart = await this.getCart(businessId, customerId);
    const existingIndex = currentCart.items.findIndex(
      (i) => i.productId === productId,
    );

    let updatedItems = [...currentCart.items];
    const priceNum = Number(product.price);

    if (existingIndex > -1) {
      updatedItems[existingIndex].quantity += quantity;
    } else {
      updatedItems.push({
        productId: product.id,
        name: product.name,
        price: priceNum,
        quantity,
        currency: product.currency || 'NGN',
        imageUrl: product.imageUrl,
      });
    }

    const subtotal = updatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const itemCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

    const newCart: CustomerCart = {
      items: updatedItems,
      subtotal,
      currency: product.currency || 'NGN',
      itemCount,
    };

    await this.stateService.updateMetadata(businessId, customerId, {
      cart: newCart,
    });

    this.logger.debug(
      `Updated cart for customer=${customerId} itemCount=${itemCount} subtotal=${subtotal}`,
    );

    return newCart;
  }

  async clearCart(businessId: string, customerId: string): Promise<void> {
    await this.stateService.updateMetadata(businessId, customerId, {
      cart: { items: [], subtotal: 0, currency: 'NGN', itemCount: 0 },
    });
  }
}
