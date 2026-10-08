import { WebhookIdempotencyService } from './webhook-idempotency.service';
import { RedisService } from '../../../redis/redis.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('WebhookIdempotencyService', () => {
  let service: WebhookIdempotencyService;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let prismaService: any;

  beforeEach(() => {
    redisService = {
      setNx: jest.fn(),
    };
    prismaService = {
      inboundIdempotency: {
        create: jest.fn(),
      },
    };

    service = new WebhookIdempotencyService(
      redisService as unknown as RedisService,
      prismaService as PrismaService,
    );
  });

  it('should acquire lock for first-time inbound message and persist to DB', async () => {
    (redisService.setNx as jest.Mock).mockResolvedValue(true);
    prismaService.inboundIdempotency.create.mockResolvedValue({ id: 'rec-1' });

    const result = await service.acquireInboundLock('biz-123', 'wamid.first_time_message');

    expect(result).toBe(true);
    expect(redisService.setNx).toHaveBeenCalledWith(
      'idempotency:inbound:biz-123:wamid.first_time_message',
      expect.any(String),
      86400,
    );
    expect(prismaService.inboundIdempotency.create).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-123',
        waMessageId: 'wamid.first_time_message',
      },
    });
  });

  it('should reject duplicate inbound message caught by Redis cache without DB write', async () => {
    (redisService.setNx as jest.Mock).mockResolvedValue(false);

    const result = await service.acquireInboundLock('biz-123', 'wamid.duplicate_message');

    expect(result).toBe(false);
    expect(prismaService.inboundIdempotency.create).not.toHaveBeenCalled();
  });

  it('should reject duplicate message caught by DB unique constraint P2002', async () => {
    (redisService.setNx as jest.Mock).mockResolvedValue(true);
    prismaService.inboundIdempotency.create.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed on the fields: (`businessId`,`waMessageId`)',
    });

    const result = await service.acquireInboundLock('biz-123', 'wamid.db_duplicate');

    expect(result).toBe(false);
  });
});
