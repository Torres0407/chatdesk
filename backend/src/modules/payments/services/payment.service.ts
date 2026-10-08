import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
  PaymentWebhookEvent,
} from '../interfaces/payment-provider.interface';
import { OrderService } from '../../orders/services/order.service';
import { OrderStatus } from '../../orders/constants/order-status.constants';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
    private readonly orderService: OrderService,
  ) {}

  async generateOrderPaymentLink(
    businessId: string,
    orderId: string,
  ): Promise<{ paymentUrl: string; reference: string }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, businessId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    const customerEmail = `${order.customer.phoneNumber.replace('+', '')}@customer.chatdesk.local`;

    const result = await this.paymentProvider.initializePayment({
      businessId,
      orderId: order.id,
      amount: Number(order.totalAmount),
      currency: order.currency || 'NGN',
      email: customerEmail,
      phoneNumber: order.customer.phoneNumber,
      metadata: {
        businessId,
        orderId: order.id,
      },
    });

    // Save payment reference on the order
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentReference: result.reference,
        paymentStatus: 'pending',
      },
    });

    return {
      paymentUrl: result.authorizationUrl,
      reference: result.reference,
    };
  }

  async processPaymentWebhook(event: PaymentWebhookEvent): Promise<any> {
    const reference = event.data?.reference;
    if (!reference) {
      this.logger.warn('Payment webhook received without reference');
      return { skipped: 'missing_reference' };
    }

    // Two-tier Idempotency: Redis atomic lock (24h TTL)
    const idempotencyKey = `idempotency:paystack:${reference}`;
    const isNew = await this.redis.setNx(idempotencyKey, 'PROCESSED', 86400);

    if (!isNew) {
      this.logger.debug(`Duplicate payment webhook for reference ${reference}. Skipping.`);
      return { skipped: 'duplicate_event' };
    }

    if (event.event === 'charge.success' && event.data.status === 'success') {
      const metadata = event.data.metadata || {};
      let businessId = metadata.businessId;
      let orderId = metadata.orderId;

      // If metadata not directly present, query order by paymentReference
      if (!orderId || !businessId) {
        const order = await this.prisma.order.findFirst({
          where: { paymentReference: reference },
          select: { id: true, businessId: true },
        });

        if (order) {
          orderId = order.id;
          businessId = order.businessId;
        }
      }

      if (!orderId || !businessId) {
        this.logger.warn(`Could not resolve order for payment reference: ${reference}`);
        return { status: 'unresolved_order' };
      }

      // Update Order Status to PAID with customer WhatsApp confirmation
      await this.orderService.updateOrderStatus(
        businessId,
        orderId,
        OrderStatus.PAID,
        true,
      );

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'success',
        },
      });

      this.logger.log(
        `Successfully processed charge.success for order=${orderId} reference=${reference}`,
      );

      return { success: true, orderId, reference };
    }

    return { received: true };
  }
}
