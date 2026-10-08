import { CartHandler } from './cart.handler';
import { ConversationState } from '../constants/conversation-state.enum';

describe('CartHandler', () => {
  let handler: CartHandler;
  let mockCartService: any;
  let mockStateService: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockCartService = {
      getCart: jest.fn(),
      addItem: jest.fn(),
      clearCart: jest.fn(),
    };
    mockStateService = {
      setState: jest.fn(),
    };
    mockOutboundService = {
      sendButtons: jest.fn(),
    };

    handler = new CartHandler(
      mockCartService,
      mockStateService,
      mockOutboundService,
    );
  });

  it('should show empty cart message if no items in cart', async () => {
    mockCartService.getCart.mockResolvedValue({
      items: [],
      subtotal: 0,
      currency: 'NGN',
      itemCount: 0,
    });

    await handler.showCart('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('cart is currently empty'),
      expect.any(Array),
    );
  });

  it('should display cart items and total amount', async () => {
    mockCartService.getCart.mockResolvedValue({
      items: [
        { productId: 'p1', name: 'Perfume', price: 12000, quantity: 1, currency: 'NGN' },
      ],
      subtotal: 12000,
      currency: 'NGN',
      itemCount: 1,
    });

    await handler.showCart('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockStateService.setState).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      ConversationState.CART,
    );
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('12,000'),
      expect.arrayContaining([
        expect.objectContaining({ id: 'btn_checkout' }),
      ]),
      expect.any(Object),
    );
  });

  it('should add item to cart and send confirmation', async () => {
    mockCartService.addItem.mockResolvedValue({
      items: [
        { productId: 'p1', name: 'Perfume', price: 12000, quantity: 1, currency: 'NGN' },
      ],
      subtotal: 12000,
      currency: 'NGN',
      itemCount: 1,
    });

    await handler.handleAddToCart(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      'add_p1',
    );

    expect(mockCartService.addItem).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      'p1',
      1,
    );
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('Added *Perfume* to your cart'),
      expect.any(Array),
    );
  });
});
