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
  let mockBookingHandler: any;
  let mockPaymentService: any;
  let mockOutboundService: any;

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
    mockBookingHandler = {
      startBookingFlow: jest.fn(),
      handleDateSelection: jest.fn(),
      handleTimeSelection: jest.fn(),
    };
    mockPaymentService = {
      generateOrderPaymentLink: jest.fn().mockResolvedValue({
        paymentUrl: 'https://checkout.paystack.com/mock_pay',
        reference: 'ref_mock_123',
      }),
    };
    mockOutboundService = {
      sendButtons: jest.fn(),
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
      mockBookingHandler,
      mockPaymentService,
      mockOutboundService,
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

  it('should route to booking handler when btn_booking is clicked', async () => {
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
        button_reply: { id: 'btn_booking', title: 'Book Service' },
      },
    });

    expect(mockBookingHandler.startBookingFlow).toHaveBeenCalledWith(
      'b1',
      'conv1',
      'c1',
      '+2348012345678',
    );
  });

  it('should route to payment generation when pay_ is clicked', async () => {
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
        button_reply: { id: 'pay_ord-123', title: 'Pay Now' },
      },
    });

    expect(mockPaymentService.generateOrderPaymentLink).toHaveBeenCalledWith(
      'b1',
      'ord-123',
    );
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'b1',
      'conv1',
      'c1',
      '+2348012345678',
      expect.stringContaining('https://checkout.paystack.com/mock_pay'),
      expect.any(Array),
      expect.any(Object),
    );
  });
});
