import { OutboundMessageProcessor } from './outbound-message.processor';
import { MessageBuilder } from '../builder/message.builder';

describe('OutboundMessageProcessor', () => {
  let processor: OutboundMessageProcessor;
  let mockPrisma: any;
  let mockMetaApiClient: any;

  beforeEach(() => {
    mockPrisma = {
      customer: { findUnique: jest.fn() },
      conversation: { findUnique: jest.fn(), update: jest.fn() },
      business: { findUnique: jest.fn() },
      message: { create: jest.fn() },
    };
    mockMetaApiClient = {
      sendMessage: jest.fn().mockResolvedValue({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.OUTBOUND_123' }],
      }),
    };
    processor = new OutboundMessageProcessor(mockPrisma, mockMetaApiClient);
  });

  it('should skip outbound message if customer is opted out', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ isOptedOut: true });

    const job = {
      name: 'send-outbound-message',
      data: {
        businessId: 'biz-1',
        conversationId: 'conv-1',
        customerId: 'cust-1',
        toPhoneNumber: '+2348012345678',
        payload: MessageBuilder.text('+2348012345678', 'Hi'),
      },
    } as any;

    const result = await processor.process(job);
    expect(result).toEqual({ skipped: 'opted_out' });
    expect(mockMetaApiClient.sendMessage).not.toHaveBeenCalled();
  });

  it('should throw error when sending freeform message outside 24-hr window', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ isOptedOut: false });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      windowExpiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
    });

    const job = {
      name: 'send-outbound-message',
      data: {
        businessId: 'biz-1',
        conversationId: 'conv-1',
        customerId: 'cust-1',
        toPhoneNumber: '+2348012345678',
        payload: MessageBuilder.text('+2348012345678', 'Hi'),
        bypass24HourWindow: false,
      },
    } as any;

    await expect(processor.process(job)).rejects.toThrow(
      /24-hour Meta window has expired/,
    );
  });

  it('should successfully send and persist outbound message when within window', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ isOptedOut: false });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      windowExpiresAt: new Date(Date.now() + 3600000), // Valid for 1 more hour
    });
    mockPrisma.business.findUnique.mockResolvedValue({
      phoneNumberId: 'meta-phone-id-123',
      accessToken: 'EAAB...',
    });

    const job = {
      name: 'send-outbound-message',
      data: {
        businessId: 'biz-1',
        conversationId: 'conv-1',
        customerId: 'cust-1',
        toPhoneNumber: '+2348012345678',
        payload: MessageBuilder.text('+2348012345678', 'Welcome to Chatdesk!'),
      },
    } as any;

    const result = await processor.process(job);

    expect(result).toEqual({ success: true, waMessageId: 'wamid.OUTBOUND_123' });
    expect(mockMetaApiClient.sendMessage).toHaveBeenCalledWith(
      'meta-phone-id-123',
      'EAAB...',
      expect.objectContaining({ type: 'text' }),
    );
    expect(mockPrisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'biz-1',
        conversationId: 'conv-1',
        waMessageId: 'wamid.OUTBOUND_123',
        direction: 'OUTBOUND',
        status: 'SENT',
      }),
    });
  });
});
