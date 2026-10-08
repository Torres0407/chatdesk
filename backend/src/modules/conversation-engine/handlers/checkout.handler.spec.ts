import { CheckoutHandler } from './checkout.handler';
import { ConversationState } from '../constants/conversation-state.enum';

describe('CheckoutHandler', () => {
  let handler: CheckoutHandler;
  let mockOrderService: any;
  let mockCartService: any;
  let mockStateService: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockOrderService = {
      createOrderFromCart: jest.fn(),
    };
    mockCartService = {
      getCart: jest.fn(),
    };
    mockStateService = {
      setState: jest.fn(),
    };
    mockOutboundService = {
      sendButtons: jest.fn(),
    };

    handler = new CheckoutHandler(
      mockOrderService,
      mockCartService,
      mockStateService,
      mockOutboundService,
    );
  });

  it('should prevent checkout when cart is empty', async () => {
    mockCartService.getCart.mockResolvedValue({ items: [], subtotal: 0, currency: 'NGN' });

    await handler.handleCheckout('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('cart is empty'),
      expect.any(Array),
    );
    expect(mockOrderService.createOrderFromCart).not.toHaveBeenCalled();
  });

  it('should create order and transition state to AWAITING_PAYMENT', async () => {
    mockCartService.getCart.mockResolvedValue({
      items: [{ productId: 'p1', name: 'Shoes', price: 20000, quantity: 1, currency: 'NGN' }],
      subtotal: 20000,
      currency: 'NGN',
    });
    mockOrderService.createOrderFromCart.mockResolvedValue({
      id: 'ord-998877',
      totalAmount: 20000,
      currency: 'NGN',
      status: 'PENDING',
    });

    await handler.handleCheckout('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockOrderService.createOrderFromCart).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      'conv-1',
      undefined,
    );
    expect(mockStateService.setState).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      ConversationState.AWAITING_PAYMENT,
      { activeOrderId: 'ord-998877' },
    );
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('Order Placed Successfully'),
      expect.arrayContaining([
        expect.objectContaining({ id: 'pay_ord-998877' }),
      ]),
      expect.any(Object),
    );
  });
});
