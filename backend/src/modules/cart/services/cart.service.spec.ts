import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;
  let mockStateService: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockStateService = {
      getState: jest.fn().mockResolvedValue({
        state: 'MAIN_MENU',
        metadata: {},
      }),
      updateMetadata: jest.fn().mockResolvedValue({}),
    };
    mockPrisma = {
      product: {
        findFirst: jest.fn(),
      },
    };
    service = new CartService(mockStateService, mockPrisma);
  });

  it('should return an empty cart when session metadata has no cart', async () => {
    const cart = await service.getCart('biz-1', 'cust-1');
    expect(cart.items).toEqual([]);
    expect(cart.subtotal).toBe(0);
    expect(cart.itemCount).toBe(0);
  });

  it('should add a new product to cart and update Redis session', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-101',
      name: 'Wireless Keyboard',
      price: 15000,
      currency: 'NGN',
      imageUrl: null,
    });

    const cart = await service.addItem('biz-1', 'cust-1', 'prod-101', 1);

    expect(cart.items.length).toBe(1);
    expect(cart.items[0].name).toBe('Wireless Keyboard');
    expect(cart.items[0].quantity).toBe(1);
    expect(cart.subtotal).toBe(15000);
    expect(cart.itemCount).toBe(1);
    expect(mockStateService.updateMetadata).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      expect.objectContaining({
        cart: expect.objectContaining({ subtotal: 15000 }),
      }),
    );
  });

  it('should increment quantity when same product is added again', async () => {
    mockStateService.getState.mockResolvedValue({
      state: 'CART',
      metadata: {
        cart: {
          items: [
            {
              productId: 'prod-101',
              name: 'Wireless Keyboard',
              price: 15000,
              quantity: 1,
              currency: 'NGN',
            },
          ],
          subtotal: 15000,
          currency: 'NGN',
          itemCount: 1,
        },
      },
    });
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-101',
      name: 'Wireless Keyboard',
      price: 15000,
      currency: 'NGN',
    });

    const cart = await service.addItem('biz-1', 'cust-1', 'prod-101', 2);

    expect(cart.items.length).toBe(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.subtotal).toBe(45000);
    expect(cart.itemCount).toBe(3);
  });

  it('should clear cart and reset totals', async () => {
    await service.clearCart('biz-1', 'cust-1');

    expect(mockStateService.updateMetadata).toHaveBeenCalledWith('biz-1', 'cust-1', {
      cart: { items: [], subtotal: 0, currency: 'NGN', itemCount: 0 },
    });
  });
});
