import { PaymentService } from './payment.service';
import { OrderStatus } from '../../orders/constants/order-status.constants';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockPaymentProvider: any;
  let mockOrderService: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    mockRedis = {
      setNx: jest.fn(),
    };
    mockPaymentProvider = {
      initializePayment: jest.fn(),
    };
    mockOrderService = {
      updateOrderStatus: jest.fn(),
    };

    service = new PaymentService(
      mockPrisma,
      mockRedis,
      mockPaymentProvider,
      mockOrderService,
    );
  });

  describe('generateOrderPaymentLink', () => {
    it('should initialize payment and update order with payment reference', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-123',
        businessId: 'biz-1',
        totalAmount: 25000,
        currency: 'NGN',
        customer: { phoneNumber: '+2348012345678' },
      });

      mockPaymentProvider.initializePayment.mockResolvedValue({
        authorizationUrl: 'https://checkout.paystack.com/pay_xyz',
        reference: 'ref_cd_123',
      });

      const res = await service.generateOrderPaymentLink('biz-1', 'ord-123');

      expect(res.paymentUrl).toBe('https://checkout.paystack.com/pay_xyz');
      expect(res.reference).toBe('ref_cd_123');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: {
          paymentReference: 'ref_cd_123',
          paymentStatus: 'pending',
        },
      });
    });
  });

  describe('processPaymentWebhook', () => {
    const event = {
      event: 'charge.success',
      data: {
        reference: 'ref_cd_123',
        amount: 2500000,
        currency: 'NGN',
        status: 'success',
        metadata: {
          businessId: 'biz-1',
          orderId: 'ord-123',
        },
      },
    };

    it('should process successful charge and transition order to PAID', async () => {
      mockRedis.setNx.mockResolvedValue(true); // First arrival: atomic lock acquired

      const res = await service.processPaymentWebhook(event as any);

      expect(res).toEqual({ success: true, orderId: 'ord-123', reference: 'ref_cd_123' });
      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
        'biz-1',
        'ord-123',
        OrderStatus.PAID,
        true,
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { paymentStatus: 'success' },
      });
    });

    it('should ignore duplicate payment webhook idempotently', async () => {
      mockRedis.setNx.mockResolvedValue(false); // Duplicate arrival: atomic lock denied

      const res = await service.processPaymentWebhook(event as any);

      expect(res).toEqual({ skipped: 'duplicate_event' });
      expect(mockOrderService.updateOrderStatus).not.toHaveBeenCalled();
    });
  });
});
