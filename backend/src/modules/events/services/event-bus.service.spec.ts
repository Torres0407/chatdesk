import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';
import { RedisService } from '../../../redis/redis.service';
import { take } from 'rxjs';

describe('EventBusService', () => {
  let service: EventBusService;
  let mockRedisService: Partial<RedisService>;
  let subscriberMessageHandler: ((channel: string, message: string) => void) | null = null;
  const mockSubscriber = {
    on: jest.fn((event: string, handler: any) => {
      if (event === 'message') {
        subscriberMessageHandler = handler;
      }
    }),
    subscribe: jest.fn().mockResolvedValue(1),
    unsubscribe: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    subscriberMessageHandler = null;
    mockRedisService = {
      publish: jest.fn().mockResolvedValue(1),
      getSubscriber: jest.fn().mockReturnValue(mockSubscriber),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('should publish a strongly typed domain event to the tenant channel', async () => {
    const businessId = 'biz-tenant-123';
    const event = await service.publishEvent('order.created', businessId, {
      orderId: 'ord-999',
      amount: 5000,
    });

    expect(event.type).toBe('order.created');
    expect(event.businessId).toBe(businessId);
    expect(event.data.orderId).toBe('ord-999');

    expect(mockRedisService.publish).toHaveBeenCalledWith(
      `events:business:${businessId}`,
      expect.stringContaining('order.created'),
    );
  });

  it('should deliver initial connection handshake and received pub/sub events via Observable', (done) => {
    const businessId = 'biz-stream-test';
    const stream$ = service.getEventStream(businessId);

    const emittedEvents: any[] = [];

    const sub = stream$.pipe(take(2)).subscribe({
      next: (event) => {
        emittedEvents.push(event);
        if (emittedEvents.length === 2) {
          expect(emittedEvents[0].type).toBe('connected');
          expect(emittedEvents[0].data.businessId).toBe(businessId);

          expect(emittedEvents[1].type).toBe('message.created');
          expect(emittedEvents[1].data.data.text).toBe('Hello SSE');
          sub.unsubscribe();
          done();
        }
      },
    });

    // Simulate incoming Redis pub/sub message
    expect(mockSubscriber.subscribe).toHaveBeenCalledWith(`events:business:${businessId}`);

    if (subscriberMessageHandler) {
      subscriberMessageHandler(
        `events:business:${businessId}`,
        JSON.stringify({
          id: 'evt-1',
          type: 'message.created',
          businessId,
          timestamp: new Date().toISOString(),
          data: { text: 'Hello SSE' },
        }),
      );
    }
  });

  it('should not leak events across different businesses', (done) => {
    const businessA = 'biz-A';
    const businessB = 'biz-B';

    const streamA$ = service.getEventStream(businessA);
    const eventsA: any[] = [];

    const subA = streamA$.subscribe({
      next: (event) => {
        eventsA.push(event);
      },
    });

    // Message sent to Business B
    if (subscriberMessageHandler) {
      subscriberMessageHandler(
        `events:business:${businessB}`,
        JSON.stringify({
          id: 'evt-b',
          type: 'conversation.updated',
          businessId: businessB,
          timestamp: new Date().toISOString(),
          data: { status: 'HUMAN_HANDLING' },
        }),
      );
    }

    setTimeout(() => {
      // Only initial 'connected' handshake should be in eventsA, no businessB event
      expect(eventsA.length).toBe(1);
      expect(eventsA[0].type).toBe('connected');
      subA.unsubscribe();
      done();
    }, 50);
  });
});
