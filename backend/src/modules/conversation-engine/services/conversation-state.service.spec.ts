import { ConversationStateService } from './conversation-state.service';
import { ConversationState } from '../constants/conversation-state.enum';

describe('ConversationStateService', () => {
  let service: ConversationStateService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    service = new ConversationStateService(mockRedis);
  });

  it('should default to MAIN_MENU state when key is not found in Redis', async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await service.getState('biz-1', 'cust-1');

    expect(result.state).toBe(ConversationState.MAIN_MENU);
    expect(result.metadata).toEqual({});
  });

  it('should parse stored state and metadata from Redis', async () => {
    const stored = {
      state: ConversationState.CART,
      metadata: { items: [{ id: 'p1', qty: 2 }] },
      updatedAt: 123456789,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(stored));

    const result = await service.getState('biz-1', 'cust-1');
    expect(result.state).toBe(ConversationState.CART);
    expect(result.metadata?.items.length).toBe(1);
  });

  it('should persist state to Redis with TTL', async () => {
    await service.setState('biz-1', 'cust-1', ConversationState.BROWSING_CATALOG, { category: 'electronics' });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'session:biz-1:cust-1',
      expect.stringContaining('"state":"BROWSING_CATALOG"'),
      86400,
    );
  });

  it('should clear state from Redis', async () => {
    await service.clearState('biz-1', 'cust-1');
    expect(mockRedis.del).toHaveBeenCalledWith('session:biz-1:cust-1');
  });
});
