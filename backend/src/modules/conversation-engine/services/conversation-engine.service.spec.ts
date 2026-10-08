import { ConversationEngineService } from './conversation-engine.service';
import { ConversationStatus } from '@prisma/client';

describe('ConversationEngineService', () => {
  let service: ConversationEngineService;
  let mockPrisma: any;
  let mockStateService: any;
  let mockGlobalCommandHandler: any;
  let mockMenuHandler: any;
  let mockFaqHandler: any;
  let mockCatalogHandler: any;
  let mockCartHandler: any;
  let mockCheckoutHandler: any;

  beforeEach(() => {
    mockPrisma = {
      customer: { findUnique: jest.fn(), update: jest.fn() },
      conversation: { findUnique: jest.fn(), update: jest.fn() },
      optOutRecord: { deleteMany: jest.fn() },
    };
    mockStateService = {
      getState: jest.fn().mockResolvedValue({ state: 'MAIN_MENU', metadata: {} }),
      setState: jest.fn(),
    };
    mockGlobalCommandHandler = {
      detectCommand: jest.fn().mockReturnValue('NONE'),
      handleStop: jest.fn(),
      handleAgentHandoff: jest.fn(),
      handleCancel: jest.fn(),
    };
    mockMenuHandler = {
      sendMainMenu: jest.fn(),
    };
    mockFaqHandler = {
      showFaqList: jest.fn(),
      handleFaqSelection: jest.fn(),
      searchAndAnswerFaq: jest.fn().mockResolvedValue(false),
    };
    mockCatalogHandler = {
      showCatalog: jest.fn(),
      showProductDetails: jest.fn(),
    };
    mockCartHandler = {
      showCart: jest.fn(),
      handleAddToCart: jest.fn(),
      handleClearCart: jest.fn(),
    };
    mockCheckoutHandler = {
      handleCheckout: jest.fn(),
    };

    service = new ConversationEngineService(
      mockPrisma,
      mockStateService,
      mockGlobalCommandHandler,
      mockMenuHandler,
      mockFaqHandler,
      mockCatalogHandler,
      mockCartHandler,
      mockCheckoutHandler,
    );
  });

  it('should suppress bot replies when conversation is in HUMAN_HANDLING status', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'c1', isOptedOut: false });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      status: ConversationStatus.HUMAN_HANDLING,
    });

    await service.processInboundMessage('b1', 'conv1', 'c1', '+2348012345678', {
      from: '2348012345678',
      id: 'wamid.123',
      timestamp: '12345',
      type: 'text',
      text: { body: 'Hello are you there?' },
    });

    expect(mockMenuHandler.sendMainMenu).not.toHaveBeenCalled();
    expect(mockFaqHandler.searchAndAnswerFaq).not.toHaveBeenCalled();
  });

  it('should return from HUMAN_HANDLING back to bot when user clicks main menu', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'c1', isOptedOut: false });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      status: ConversationStatus.HUMAN_HANDLING,
    });
    mockGlobalCommandHandler.detectCommand.mockReturnValue('MENU');

    await service.processInboundMessage('b1', 'conv1', 'c1', '+2348012345678', {
      from: '2348012345678',
      id: 'wamid.123',
      timestamp: '12345',
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'btn_menu', title: 'Main Menu' },
      },
    });

    expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv1' },
      data: { status: ConversationStatus.BOT },
    });
    expect(mockMenuHandler.sendMainMenu).toHaveBeenCalledWith('b1', 'conv1', 'c1', '+2348012345678');
  });

  it('should route to agent handoff when agent command is received', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'c1', isOptedOut: false });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      status: ConversationStatus.BOT,
    });
    mockGlobalCommandHandler.detectCommand.mockReturnValue('AGENT');

    await service.processInboundMessage('b1', 'conv1', 'c1', '+2348012345678', {
      from: '2348012345678',
      id: 'wamid.123',
      timestamp: '12345',
      type: 'text',
      text: { body: 'talk to human' },
    });

    expect(mockGlobalCommandHandler.handleAgentHandoff).toHaveBeenCalledWith(
      'b1',
      'conv1',
      'c1',
      '+2348012345678',
    );
  });

  it('should route to catalog handler when btn_catalog is clicked', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'c1', isOptedOut: false });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      status: ConversationStatus.BOT,
    });

    await service.processInboundMessage('b1', 'conv1', 'c1', '+2348012345678', {
      from: '2348012345678',
      id: 'wamid.123',
      timestamp: '12345',
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'btn_catalog', title: 'Catalog' },
      },
    });

    expect(mockCatalogHandler.showCatalog).toHaveBeenCalledWith(
      'b1',
      'conv1',
      'c1',
      '+2348012345678',
    );
  });

  it('should route to cart handler when add_item is clicked', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'c1', isOptedOut: false });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      status: ConversationStatus.BOT,
    });

    await service.processInboundMessage('b1', 'conv1', 'c1', '+2348012345678', {
      from: '2348012345678',
      id: 'wamid.123',
      timestamp: '12345',
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'add_prod-123', title: 'Add to Cart' },
      },
    });

    expect(mockCartHandler.handleAddToCart).toHaveBeenCalledWith(
      'b1',
      'conv1',
      'c1',
      '+2348012345678',
      'add_prod-123',
    );
  });
});
