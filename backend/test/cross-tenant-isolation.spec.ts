import { NotFoundException } from '@nestjs/common';
import { ConversationManagementService } from '../src/modules/conversations/services/conversation-management.service';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { BookingsController } from '../src/modules/bookings/bookings.controller';
import { CatalogController } from '../src/modules/catalog/catalog.controller';
import { FaqsController } from '../src/modules/faqs/faqs.controller';

describe('Cross-Tenant Isolation Suite', () => {
  const businessA = 'biz_AAA_111';
  const businessB = 'biz_BBB_222';

  let mockPrisma: any;
  let mockOutboundService: any;
  let mockOrderService: any;
  let mockBookingService: any;

  let conversationService: ConversationManagementService;
  let ordersController: OrdersController;
  let bookingsController: BookingsController;
  let catalogController: CatalogController;
  let faqsController: FaqsController;

  beforeEach(() => {
    mockPrisma = {
      conversation: {
        findFirst: jest.fn((query: any) => {
          if (query.where.businessId === businessA && query.where.id === 'conv_A_1') {
            return Promise.resolve({ id: 'conv_A_1', businessId: businessA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn((query: any) => {
          if (query.where.businessId === businessA) {
            return Promise.resolve([{ id: 'conv_A_1', businessId: businessA }]);
          }
          return Promise.resolve([]);
        }),
      },
      order: {
        findFirst: jest.fn((query: any) => {
          if (query.where.businessId === businessA && query.where.id === 'ord_A_1') {
            return Promise.resolve({ id: 'ord_A_1', businessId: businessA });
          }
          return Promise.resolve(null);
        }),
      },
      booking: {
        findFirst: jest.fn((query: any) => {
          if (query.where.businessId === businessA && query.where.id === 'bk_A_1') {
            return Promise.resolve({ id: 'bk_A_1', businessId: businessA });
          }
          return Promise.resolve(null);
        }),
      },
      product: {
        findFirst: jest.fn((query: any) => {
          if (query.where.businessId === businessA && query.where.id === 'prod_A_1') {
            return Promise.resolve({ id: 'prod_A_1', businessId: businessA });
          }
          return Promise.resolve(null);
        }),
      },
      faq: {
        findFirst: jest.fn((query: any) => {
          if (query.where.businessId === businessA && query.where.id === 'faq_A_1') {
            return Promise.resolve({ id: 'faq_A_1', businessId: businessA });
          }
          return Promise.resolve(null);
        }),
      },
    };

    mockOutboundService = { sendText: jest.fn() };
    mockOrderService = { updateOrderStatus: jest.fn() };
    mockBookingService = { cancelBooking: jest.fn(), rescheduleBooking: jest.fn() };
    const mockEventBus: any = { publishEvent: jest.fn().mockResolvedValue({}) };

    conversationService = new ConversationManagementService(mockPrisma, mockOutboundService, mockEventBus);
    ordersController = new OrdersController(mockOrderService, mockPrisma);
    bookingsController = new BookingsController(mockBookingService, mockPrisma);
    catalogController = new CatalogController(mockPrisma);
    faqsController = new FaqsController(mockPrisma);
  });

  it('Tenant Isolation: Staff of Business A cannot access Conversation of Business B (returns 404)', async () => {
    await expect(
      conversationService.getConversationById(businessA, 'conv_B_999'),
    ).rejects.toThrow(NotFoundException);

    // Business A accessing own conversation succeeds
    const ownConv = await conversationService.getConversationById(businessA, 'conv_A_1');
    expect(ownConv.id).toBe('conv_A_1');
  });

  it('Tenant Isolation: Staff of Business A cannot access Order of Business B', async () => {
    await expect(
      ordersController.getOrder(businessA, 'ord_B_999'),
    ).rejects.toThrow(/not found/i);

    const ownOrder = await ordersController.getOrder(businessA, 'ord_A_1');
    expect(ownOrder.id).toBe('ord_A_1');
  });

  it('Tenant Isolation: Staff of Business A cannot access Booking of Business B', async () => {
    await expect(
      bookingsController.getBooking(businessA, 'bk_B_999'),
    ).rejects.toThrow(NotFoundException);

    const ownBooking = await bookingsController.getBooking(businessA, 'bk_A_1');
    expect(ownBooking.id).toBe('bk_A_1');
  });

  it('Tenant Isolation: Staff of Business A cannot access Product of Business B', async () => {
    await expect(
      catalogController.getProduct(businessA, 'prod_B_999'),
    ).rejects.toThrow(NotFoundException);

    const ownProduct = await catalogController.getProduct(businessA, 'prod_A_1');
    expect(ownProduct.id).toBe('prod_A_1');
  });

  it('Tenant Isolation: Staff of Business A cannot access FAQ of Business B', async () => {
    await expect(
      faqsController.getFaq(businessA, 'faq_B_999'),
    ).rejects.toThrow(NotFoundException);

    const ownFaq = await faqsController.getFaq(businessA, 'faq_A_1');
    expect(ownFaq.id).toBe('faq_A_1');
  });
});
