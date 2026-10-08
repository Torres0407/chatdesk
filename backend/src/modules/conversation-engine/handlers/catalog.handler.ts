import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { ConversationState } from '../constants/conversation-state.enum';

@Injectable()
export class CatalogHandler {
  private readonly logger = new Logger(CatalogHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: ConversationStateService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async showCatalog(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    if (products.length === 0) {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        'Our catalog is currently being updated. No items are available right now. Please check back soon!',
        [{ id: 'btn_menu', title: 'Main Menu' }],
      );
      return;
    }

    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.BROWSING_CATALOG,
    );

    const rows = products.map((p) => ({
      id: `prod_${p.id}`,
      title: p.name.length > 24 ? `${p.name.substring(0, 21)}...` : p.name,
      description: `${p.currency || 'NGN'} ${Number(p.price).toLocaleString()} - ${
        p.description ? p.description.substring(0, 45) : 'Available in stock'
      }`,
    }));

    await this.outboundService.sendList(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      '🛍️ *Product Catalog*\nSelect any product below to view details and add it to your order:',
      'View Products',
      [{ title: 'Available Products', rows }],
      {
        footerText: 'Type "cart" or "menu" anytime',
      },
    );
  }

  async showProductDetails(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    productId: string,
  ): Promise<void> {
    const cleanId = productId.replace(/^prod_/, '');
    const product = await this.prisma.product.findFirst({
      where: {
        id: cleanId,
        businessId,
        isActive: true,
      },
    });

    if (!product) {
      await this.showCatalog(businessId, conversationId, customerId, customerPhone);
      return;
    }

    const priceFormatted = `${product.currency || 'NGN'} ${Number(product.price).toLocaleString()}`;
    const descText = product.description ? `\n\n_${product.description}_` : '';
    const bodyText = `📦 *${product.name}*\n💰 *Price:* ${priceFormatted}${descText}`;

    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      bodyText,
      [
        { id: `add_${product.id}`, title: '🛒 Add to Cart' },
        { id: 'btn_cart', title: '🛍️ View Cart' },
        { id: 'btn_catalog', title: '⬅️ More Items' },
      ],
      {
        footerText: 'Select an option to continue',
      },
    );
  }
}
