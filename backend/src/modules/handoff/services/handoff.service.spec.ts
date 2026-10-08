import { Test, TestingModule } from '@nestjs/testing';
import { HandoffService } from './handoff.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { EventBusService } from '../../events/services/event-bus.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationStateService } from '../../conversation-engine/services/conversation-state.service';
import { ConversationStatus } from '@prisma/client';

describe('HandoffService', () => {
  let service: HandoffService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockEventBus: any;
  let mockOutbound: any;
  let mockState: any;

  beforeEach(async () => {
    mockPrisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-1',
          settings: {
            operatingHours: JSON.stringify({
              monday: { isOpen: true, open: '09:00', close: '18:00' },
              tuesday: { isOpen: true, open: '09:00', close: '18:00' },
              wednesday: { isOpen: true, open: '09:00', close: '18:00' },
              thursday: { isOpen: true, open: '09:00', close: '18:00' },
              friday: { isOpen: true, open: '09:00', close: '18:00' },
              saturday: { isOpen: false },
              sunday: { isOpen: false },
            }),
          },
        }),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cust-1',
          phoneNumber: '+2348012345678',
          name: 'Jane Doe',
        }),
      },
      conversation: {
        update: jest.fn().mockResolvedValue({
          id: 'conv-1',
          status: ConversationStatus.HUMAN_HANDLING,
          updatedAt: new Date(),
        }),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockEventBus = {
      publishEvent: jest.fn().mockResolvedValue({}),
    };

    mockOutbound = {
      sendButtons: jest.fn().mockResolvedValue({}),
      sendText: jest.fn().mockResolvedValue({}),
    };

    mockState = {
      setState: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoffService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: OutboundMessageService, useValue: mockOutbound },
        { provide: ConversationStateService, useValue: mockState },
      ],
    }).compile();

    service = module.get<HandoffService>(HandoffService);
  });

  describe('evaluateHandoff', () => {
    it('should trigger handoff on explicit agent button click', async () => {
      const result = await service.evaluateHandoff('biz-1', 'cust-1', '', 'btn_agent');
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe('BUTTON_CLICK');
      expect(result.priority).toBe('NORMAL');
    });

    it('should trigger urgent handoff on high-priority words like fraud or manager', async () => {
      const result = await service.evaluateHandoff('biz-1', 'cust-1', 'I suspect fraud on my account, get me a manager!');
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe('URGENT_KEYWORD');
      expect(result.priority).toBe('URGENT');
    });

    it('should trigger normal handoff on explicit human request', async () => {
      const result = await service.evaluateHandoff('biz-1', 'cust-1', 'I want to speak with an agent please');
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe('KEYWORD');
      expect(result.priority).toBe('NORMAL');
    });

    it('should return false for regular messages', async () => {
      const result = await service.evaluateHandoff('biz-1', 'cust-1', 'Do you sell red shirts?');
      expect(result.shouldHandoff).toBe(false);
    });
  });

  describe('consecutive fallbacks', () => {
    it('should not handoff on first or second unhandled fallback', async () => {
      mockRedis.get.mockResolvedValueOnce('0'); // 1st count
      const r1 = await service.recordFallbackAndCheckThreshold('biz-1', 'cust-1');
      expect(r1.shouldHandoff).toBe(false);

      mockRedis.get.mockResolvedValueOnce('1'); // 2nd count
      const r2 = await service.recordFallbackAndCheckThreshold('biz-1', 'cust-1');
      expect(r2.shouldHandoff).toBe(false);
    });

    it('should trigger handoff when threshold of 3 consecutive fallbacks is reached', async () => {
      mockRedis.get.mockResolvedValueOnce('2'); // 3rd count
      const r3 = await service.recordFallbackAndCheckThreshold('biz-1', 'cust-1');
      expect(r3.shouldHandoff).toBe(true);
      expect(r3.reason).toBe('CONSECUTIVE_FALLBACKS');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('isWithinOperatingHours', () => {
    it('should correctly identify within and outside hours', () => {
      const settings = {
        operatingHours: {
          monday: { isOpen: true, open: '09:00', close: '18:00' },
          sunday: { isOpen: false },
        },
      };

      // Monday at 14:00 (2:00 PM) -> within
      const mondayAfternoon = new Date('2026-10-12T14:00:00Z'); // Note: getDay() on this is Monday
      const isMonday = service.isWithinOperatingHours(settings, new Date(2026, 9, 12, 14, 0)); // Oct 12, 2026 is Monday
      expect(isMonday).toBe(true);

      // Sunday -> closed
      const isSunday = service.isWithinOperatingHours(settings, new Date(2026, 9, 11, 14, 0)); // Oct 11, 2026 is Sunday
      expect(isSunday).toBe(false);
    });
  });

  describe('executeHandoff', () => {
    it('should update DB, set Redis state, publish handoff.triggered SSE event, and send customer WhatsApp notification', async () => {
      await service.executeHandoff(
        'biz-1',
        'conv-1',
        'cust-1',
        '+2348012345678',
        { shouldHandoff: true, reason: 'KEYWORD', priority: 'NORMAL' },
        'talk to human',
      );

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { status: ConversationStatus.HUMAN_HANDLING },
      });

      expect(mockState.setState).toHaveBeenCalledWith('biz-1', 'cust-1', 'HUMAN_HANDLING');

      expect(mockEventBus.publishEvent).toHaveBeenCalledWith(
        'handoff.triggered',
        'biz-1',
        expect.objectContaining({
          conversationId: 'conv-1',
          reason: 'KEYWORD',
          priority: 'NORMAL',
        }),
      );

      expect(mockOutbound.sendButtons).toHaveBeenCalled();
    });
  });
});
