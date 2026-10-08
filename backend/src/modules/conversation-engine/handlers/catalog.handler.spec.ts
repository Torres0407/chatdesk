import { CatalogHandler } from './catalog.handler';
import { ConversationState } from '../constants/conversation-state.enum';

describe('CatalogHandler', () => {
  let handler: CatalogHandler;
  let mockPrisma: any;
  let mockStateService: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockPrisma = {
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    mockStateService = {
      setState: jest.fn(),
    };
    mockOutboundService = {
      sendButtons: jest.fn(),
      sendList: jest.fn(),
    };
    handler = new CatalogHandler(
      mockPrisma,
      mockStateService,
      mockOutboundService,
    );
  });

  it('should send empty catalog message if no products exist', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await handler.showCatalog('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('catalog is currently being updated'),
      expect.any(Array),
    );
  });

  it('should render interactive list of active products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Product A', price: 2500, currency: 'NGN', description: 'Desc A' },
      { id: 'p2', name: 'Product B', price: 4000, currency: 'NGN', description: 'Desc B' },
    ]);

    await handler.showCatalog('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockStateService.setState).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      ConversationState.BROWSING_CATALOG,
    );
    expect(mockOutboundService.sendList).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('Product Catalog'),
      'View Products',
      expect.arrayContaining([
        expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({ id: 'prod_p1', title: 'Product A' }),
          ]),
        }),
      ]),
      expect.any(Object),
    );
  });

  it('should render product details with add-to-cart button', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'p1',
      name: 'Product A',
      price: 2500,
      currency: 'NGN',
      description: 'Quality item',
    });

    await handler.showProductDetails('biz-1', 'conv-1', 'cust-1', '+2348012345678', 'prod_p1');

    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('Product A'),
      expect.arrayContaining([
        expect.objectContaining({ id: 'add_p1', title: '🛒 Add to Cart' }),
      ]),
      expect.any(Object),
    );
  });
});
