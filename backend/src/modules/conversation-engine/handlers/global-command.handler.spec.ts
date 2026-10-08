import { GlobalCommandHandler } from './global-command.handler';
import { ConversationState } from '../constants/conversation-state.enum';
import { ConversationStatus } from '@prisma/client';

describe('GlobalCommandHandler', () => {
  let handler: GlobalCommandHandler;
  let mockPrisma: any;
  let mockStateService: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockPrisma = {
      customer: { update: jest.fn() },
      optOutRecord: { upsert: jest.fn() },
      conversation: { update: jest.fn() },
    };
    mockStateService = {
      setState: jest.fn(),
      clearState: jest.fn(),
    };
    mockOutboundService = {
      sendText: jest.fn(),
      sendButtons: jest.fn(),
    };
    handler = new GlobalCommandHandler(
      mockPrisma,
      mockStateService,
      mockOutboundService,
    );
  });

  describe('detectCommand', () => {
    it('should detect STOP keywords', () => {
      expect(handler.detectCommand('STOP')).toBe('STOP');
      expect(handler.detectCommand('unsubscribe')).toBe('STOP');
      expect(handler.detectCommand('opt out')).toBe('STOP');
    });

    it('should detect MENU keywords', () => {
      expect(handler.detectCommand('menu')).toBe('MENU');
      expect(handler.detectCommand('main menu')).toBe('MENU');
      expect(handler.detectCommand('start')).toBe('MENU');
    });

    it('should detect CANCEL keywords', () => {
      expect(handler.detectCommand('cancel')).toBe('CANCEL');
      expect(handler.detectCommand('abort')).toBe('CANCEL');
    });

    it('should detect AGENT keywords', () => {
      expect(handler.detectCommand('agent')).toBe('AGENT');
      expect(handler.detectCommand('human')).toBe('AGENT');
      expect(handler.detectCommand('talk to staff')).toBe('AGENT');
    });

    it('should return NONE for regular messages', () => {
      expect(handler.detectCommand('I want to buy a pair of shoes')).toBe('NONE');
    });
  });

  describe('handleStop', () => {
    it('should update customer, create opt out record, clear state and send confirmation', async () => {
      await handler.handleStop('biz-1', 'conv-1', 'cust-1', '+2348012345678');

      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: expect.objectContaining({ isOptedOut: true }),
      });
      expect(mockPrisma.optOutRecord.upsert).toHaveBeenCalled();
      expect(mockStateService.clearState).toHaveBeenCalledWith('biz-1', 'cust-1');
      expect(mockOutboundService.sendText).toHaveBeenCalledWith(
        'biz-1',
        'conv-1',
        'cust-1',
        '+2348012345678',
        expect.stringContaining('unsubscribed'),
      );
    });
  });

  describe('handleAgentHandoff', () => {
    it('should update conversation status to HUMAN_HANDLING and notify customer', async () => {
      await handler.handleAgentHandoff('biz-1', 'conv-1', 'cust-1', '+2348012345678');

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { status: ConversationStatus.HUMAN_HANDLING },
      });
      expect(mockStateService.setState).toHaveBeenCalledWith(
        'biz-1',
        'cust-1',
        ConversationState.HUMAN_HANDLING,
      );
      expect(mockOutboundService.sendButtons).toHaveBeenCalled();
    });
  });
});
