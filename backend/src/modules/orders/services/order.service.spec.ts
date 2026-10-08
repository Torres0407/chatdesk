import { OrderService } from './order.service';
import { OrderStatus } from '../constants/order-status.constants';

describe('OrderService', () => {
  let service: OrderService;
  let mockPrisma: any;
  let mockCartService: any;
  let mockTransitionService: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    mockCartService = {
      getCart: jest.fn(),
      clearCart: jest.fn(),
    };
    mockTransitionService = {
      validateTransition: jest.fn(),
    };
    mockOutboundService = {
      sendText: jest.fn(),
    };

    service = new OrderService(
      mockPrisma,
      mockCartService,
      mockTransitionService,
      mockOutboundService,
    );
  });

  describe('createOrderFromCart', () => {
    it('should throw error when attempting to checkout an empty cart', async () => {
      mockCartService.getCart.mockResolvedValue({ items: [], subtotal: 0, currency: 'NGN' });

      await expect(
        service.createOrderFromCart('biz-1', 'cust-1', 'conv-1'),
      ).rejects.toThrow('Cannot create order from an empty cart.');
    });

    it('should create order and items and clear the cart', async () => {
      mockCartService.getCart.mockResolvedValue({
        items: [
          { productId: 'p1', name: 'Item 1', price: 5000, quantity: 2, currency: 'NGN' },
        ],
        subtotal: 10000,
        currency: 'NGN',
        itemCount: 2,
      });

      mockPrisma.order.create.mockResolvedValue({
        id: 'ord-123456',
        businessId: 'biz-1',
        customerId: 'cust-1',
        totalAmount: 10000,
        currency: 'NGN',
        status: OrderStatus.PENDING,
      });

      const order = await service.createOrderFromCart('biz-1', 'cust-1', 'conv-1');

      expect(order.id).toBe('ord-123456');
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz-1',
            customerId: 'cust-1',
            status: OrderStatus.PENDING,
            totalAmount: 10000,
          }),
        }),
      );
      expect(mockCartService.clearCart).toHaveBeenCalledWith('biz-1', 'cust-1');
    });
  });

  describe('updateOrderStatus', () => {
    it('should update status and send customer WhatsApp notification', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-123456',
        businessId: 'biz-1',
        customerId: 'cust-1',
        conversationId: 'conv-1',
        status: OrderStatus.PENDING,
        totalAmount: 10000,
        currency: 'NGN',
        customer: { phoneNumber: '+2348012345678' },
      });

      mockPrisma.order.update.mockResolvedValue({
        id: 'ord-123456',
        status: OrderStatus.PAID,
      });

      const updated = await service.updateOrderStatus(
        'biz-1',
        'ord-123456',
        OrderStatus.PAID,
        true,
      );

      expect(mockTransitionService.validateTransition).toHaveBeenCalledWith(
        OrderStatus.PENDING,
        OrderStatus.PAID,
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123456' },
        data: { status: OrderStatus.PAID },
        include: { items: true, customer: true },
      });
      expect(mockOutboundService.sendText).toHaveBeenCalledWith(
        'biz-1',
        'conv-1',
        'cust-1',
        '+2348012345678',
        expect.stringContaining('Payment Confirmed'),
      );
    });
  });
});
