import { WebhookProcessor } from './webhook.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';
import textMessageFixture from '../../../../test/fixtures/meta-payloads/text-message.fixture.json';
import statusUpdateFixture from '../../../../test/fixtures/meta-payloads/status-update.fixture.json';
import buttonReplyFixture from '../../../../test/fixtures/meta-payloads/button-reply.fixture.json';
import listReplyFixture from '../../../../test/fixtures/meta-payloads/list-reply.fixture.json';

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  let prismaService: any;
  let idempotencyService: jest.Mocked<Partial<WebhookIdempotencyService>>;

  beforeEach(() => {
    prismaService = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-test-1',
          phoneNumberId: 'phone_num_id_123',
        }),
      },
      customer: {
        upsert: jest.fn().mockResolvedValue({
          id: 'cust-1',
          businessId: 'biz-test-1',
          phoneNumber: '+2348012345678',
          isOptedOut: false,
        }),
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'conv-1',
          businessId: 'biz-test-1',
          customerId: 'cust-1',
        }),
      },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    idempotencyService = {
      acquireInboundLock: jest.fn().mockResolvedValue(true),
    };

    const mockConversationEngine = {
      processInboundMessage: jest.fn().mockResolvedValue(undefined),
    };

    const mockEventBus = {
      publishEvent: jest.fn().mockResolvedValue({}),
    };

    processor = new WebhookProcessor(
      prismaService as PrismaService,
      idempotencyService as unknown as WebhookIdempotencyService,
      mockConversationEngine as any,
      mockEventBus as any,
    );
  });

  it('should process text message for existing business and store message', async () => {
    prismaService.business.findUnique.mockResolvedValue({
      id: 'biz-test-1',
      phoneNumberId: 'phone_num_id_123',
    });
    (idempotencyService.acquireInboundLock as jest.Mock).mockResolvedValue(true);
    prismaService.customer.upsert.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-test-1',
      phoneNumber: '+2348012345678',
      isOptedOut: false,
    });
    prismaService.conversation.findFirst.mockResolvedValue(null);
    prismaService.conversation.upsert.mockResolvedValue({
      id: 'conv-1',
      businessId: 'biz-test-1',
      customerId: 'cust-1',
    });
    prismaService.message.create.mockResolvedValue({ id: 'msg-1' });

    const job = {
      name: 'process-webhook-entry',
      data: {
        payload: textMessageFixture,
        receivedAt: new Date().toISOString(),
      },
    };

    const result = await processor.process(job as any);

    expect(result).toEqual({ processed: 1 });
    expect(prismaService.business.findUnique).toHaveBeenCalledWith({
      where: { phoneNumberId: 'phone_num_id_123' },
    });
    expect(idempotencyService.acquireInboundLock).toHaveBeenCalledWith(
      'biz-test-1',
      'wamid.HBgLMjM0ODAxMjM0NTY3OBUCABEYEjExMjIzMzQ0NTU2NgA=',
    );
    expect(prismaService.message.create).toHaveBeenCalled();
  });

  it('should skip duplicate inbound message when idempotency lock fails', async () => {
    prismaService.business.findUnique.mockResolvedValue({
      id: 'biz-test-1',
      phoneNumberId: 'phone_num_id_123',
    });
    (idempotencyService.acquireInboundLock as jest.Mock).mockResolvedValue(false);

    const job = {
      name: 'process-webhook-entry',
      data: {
        payload: textMessageFixture,
        receivedAt: new Date().toISOString(),
      },
    };

    const result = await processor.process(job as any);

    expect(result).toEqual({ processed: 0 });
    expect(prismaService.customer.upsert).not.toHaveBeenCalled();
    expect(prismaService.message.create).not.toHaveBeenCalled();
  });

  it('should ignore message if customer has opted out', async () => {
    prismaService.business.findUnique.mockResolvedValue({
      id: 'biz-test-1',
      phoneNumberId: 'phone_num_id_123',
    });
    (idempotencyService.acquireInboundLock as jest.Mock).mockResolvedValue(true);
    prismaService.customer.upsert.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-test-1',
      phoneNumber: '+2348012345678',
      isOptedOut: true, // Opted out
    });

    const job = {
      name: 'process-webhook-entry',
      data: {
        payload: textMessageFixture,
        receivedAt: new Date().toISOString(),
      },
    };

    await processor.process(job as any);

    expect(prismaService.message.create).not.toHaveBeenCalled();
  });

  it('should process status updates (delivered)', async () => {
    prismaService.business.findUnique.mockResolvedValue({
      id: 'biz-test-1',
      phoneNumberId: 'phone_num_id_123',
    });
    prismaService.message.updateMany.mockResolvedValue({ count: 1 });

    const job = {
      name: 'process-webhook-entry',
      data: {
        payload: statusUpdateFixture,
        receivedAt: new Date().toISOString(),
      },
    };

    const result = await processor.process(job as any);

    expect(result).toEqual({ processed: 1 });
    expect(prismaService.message.updateMany).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-test-1',
        waMessageId: 'wamid.HBgLMjM0ODAxMjM0NTY3OBUCABEYEjExMjIzMzQ0NTU2NgA=',
      },
      data: {
        status: 'DELIVERED',
      },
    });
  });

  it('should handle interactive button and list reply messages', async () => {
    prismaService.business.findUnique.mockResolvedValue({
      id: 'biz-test-1',
      phoneNumberId: 'phone_num_id_123',
    });
    (idempotencyService.acquireInboundLock as jest.Mock).mockResolvedValue(true);
    prismaService.customer.upsert.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-test-1',
      phoneNumber: '+2348012345678',
      isOptedOut: false,
    });
    prismaService.conversation.findFirst.mockResolvedValue(null);
    prismaService.conversation.upsert.mockResolvedValue({ id: 'conv-1' });

    // Test button reply
    await processor.process({
      name: 'process-webhook-entry',
      data: { payload: buttonReplyFixture, receivedAt: new Date().toISOString() },
    } as any);

    // Test list reply
    await processor.process({
      name: 'process-webhook-entry',
      data: { payload: listReplyFixture, receivedAt: new Date().toISOString() },
    } as any);

    expect(prismaService.message.create).toHaveBeenCalledTimes(2);
  });
});
