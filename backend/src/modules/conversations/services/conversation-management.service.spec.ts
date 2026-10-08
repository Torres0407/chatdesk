import { ConversationManagementService } from './conversation-management.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';

describe('ConversationManagementService', () => {
  let service: ConversationManagementService;
  let mockPrisma: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockPrisma = {
      conversation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
      },
    };
    mockOutboundService = {
      sendText: jest.fn(),
    };
    const mockEventBus: any = {
      publishEvent: jest.fn().mockResolvedValue({}),
    };

    service = new ConversationManagementService(mockPrisma, mockOutboundService, mockEventBus);
  });

  describe('getConversationById', () => {
    it('should throw NotFoundException when conversation does not belong to business', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        service.getConversationById('biz-A', 'conv-belonging-to-biz-B'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-belonging-to-biz-B',
          businessId: 'biz-A',
        },
        include: expect.any(Object),
      });
    });
  });

  describe('takeOver and handBack', () => {
    it('should assign staff and transition status to HUMAN_HANDLING', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        businessId: 'biz-1',
      });
      mockPrisma.conversation.update.mockResolvedValue({
        id: 'conv-1',
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: 'staff-101',
      });

      const updated = await service.takeOver('biz-1', 'conv-1', 'staff-101');
      expect(updated.status).toBe(ConversationStatus.HUMAN_HANDLING);
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: {
          status: ConversationStatus.HUMAN_HANDLING,
          assignedStaffId: 'staff-101',
        },
        include: expect.any(Object),
      });
    });

    it('should unassign staff and transition status back to BOT on handBack', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        businessId: 'biz-1',
      });
      mockPrisma.conversation.update.mockResolvedValue({
        id: 'conv-1',
        status: ConversationStatus.BOT,
        assignedStaffId: null,
      });

      const updated = await service.handBack('biz-1', 'conv-1');
      expect(updated.status).toBe(ConversationStatus.BOT);
    });
  });

  describe('sendStaffReply', () => {
    it('should throw ConflictException if conversation is not in HUMAN_HANDLING assigned to staff', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        businessId: 'biz-1',
        status: ConversationStatus.BOT, // not in human handling
        assignedStaffId: null,
      });

      await expect(
        service.sendStaffReply('biz-1', 'conv-1', 'staff-101', 'Hello customer'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if 24-hr window has expired', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        businessId: 'biz-1',
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: 'staff-101',
        windowExpiresAt: new Date(Date.now() - 3600000), // expired 1hr ago
      });

      await expect(
        service.sendStaffReply('biz-1', 'conv-1', 'staff-101', 'Hello customer'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enqueue outbound WhatsApp reply when valid', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        businessId: 'biz-1',
        customerId: 'cust-1',
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: 'staff-101',
        windowExpiresAt: new Date(Date.now() + 3600000), // valid for 1hr
        customer: { phoneNumber: '+2348012345678' },
      });

      await service.sendStaffReply('biz-1', 'conv-1', 'staff-101', 'Hello customer!');

      expect(mockOutboundService.sendText).toHaveBeenCalledWith(
        'biz-1',
        'conv-1',
        'cust-1',
        '+2348012345678',
        'Hello customer!',
        'staff-101',
      );
    });
  });
});
