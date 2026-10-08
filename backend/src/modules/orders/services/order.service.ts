import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CartService } from '../../cart/services/cart.service';
import { OrderTransitionService } from './order-transition.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { OrderStatus } from '../constants/order-status.constants';
import { EventBusService } from '../../events/services/event-bus.service';
import { Optional } from '@nestjs/common';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly transitionService: OrderTransitionService,
    private readonly outboundService: OutboundMessageService,
    @Optional()
    private readonly eventBus?: EventBusService,
  ) {}

  async createOrderFromCart(
    businessId: string,
    customerId: string,
    conversationId: string,
    notes?: string,
  ): Promise<any> {
    const cart = await this.cartService.getCart(businessId, customerId);

    if (!cart.items || cart.items.length === 0) {
      throw new Error('Cannot create order from an empty cart.');
    }

    // Persist Order and OrderItems atomically
    const order = await this.prisma.order.create({
      data: {
        businessId,
        customerId,
        conversationId,
        status: OrderStatus.PENDING,
        totalAmount: cart.subtotal,
        currency: cart.currency,
        notes: notes || null,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            unitPrice: item.price,
            quantity: item.quantity,
            totalPrice: item.price * item.quantity,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    // Clear cart once order is placed
    await this.cartService.clearCart(businessId, customerId);

    this.logger.log(`Created order ${order.id} for business=${businessId} amount=${order.totalAmount}`);

    await this.eventBus?.publishEvent('order.created', businessId, {
      orderId: order.id,
      customerId: order.customerId,
      totalAmount: order.totalAmount,
      currency: order.currency,
      status: order.status,
    });

    return order;
  }

  async updateOrderStatus(
    businessId: string,
    orderId: string,
    targetStatus: OrderStatus,
    notifyCustomer = true,
  ): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        businessId,
      },
      include: {
        customer: true,
        conversation: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found for business ${businessId}.`);
    }

    // Enforce valid transition table
    this.transitionService.validateTransition(order.status as OrderStatus, targetStatus);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: targetStatus },
      include: { items: true, customer: true },
    });

    this.logger.log(
      `Order ${orderId} transitioned from ${order.status} to ${targetStatus}`,
    );

    await this.eventBus?.publishEvent('order.updated', businessId, {
      orderId: updated.id,
      previousStatus: order.status,
      status: targetStatus,
    });

    // Notify customer on WhatsApp if conversation exists
    if (notifyCustomer && order.conversationId && order.customer?.phoneNumber) {
      const statusMessage = this.formatStatusUpdateMessage(
        order.id,
        targetStatus,
        order.currency,
        Number(order.totalAmount),
      );

      await this.outboundService.sendText(
        businessId,
        order.conversationId,
        order.customerId,
        order.customer.phoneNumber,
        statusMessage,
      );
    }

    return updated;
  }

  private formatStatusUpdateMessage(
    orderId: string,
    status: OrderStatus,
    currency: string,
    amount: number,
  ): string {
    const shortId = orderId.slice(-6).toUpperCase();
    switch (status) {
      case OrderStatus.PAID:
        return `✅ *Payment Confirmed!*\nYour order *#${shortId}* (${currency} ${amount.toLocaleString()}) has been received and is being processed.`;
      case OrderStatus.PREPARING:
        return `🍳 *Order Update!*\nYour order *#${shortId}* is currently being prepared by our team.`;
      case OrderStatus.COMPLETED:
        return `🎉 *Order Completed!*\nYour order *#${shortId}* is complete/delivered. Thank you for shopping with us!`;
      case OrderStatus.CANCELLED:
        return `❌ *Order Cancelled*\nYour order *#${shortId}* has been cancelled. Please contact support if you have any questions.`;
      default:
        return `ℹ️ Order *#${shortId}* status updated to: ${status}`;
    }
  }
}
