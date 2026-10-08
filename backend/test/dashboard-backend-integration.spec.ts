import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { ConversationManagementService } from '../src/modules/conversations/services/conversation-management.service';
import { OrderService } from '../src/modules/orders/services/order.service';
import { OrderTransitionService } from '../src/modules/orders/services/order-transition.service';
import { BookingService } from '../src/modules/bookings/services/booking.service';
import { EventBusService } from '../src/modules/events/services/event-bus.service';
import { ConversationStatus, BookingStatus } from '@prisma/client';
import { OrderStatus } from '../src/modules/orders/constants/order-status.constants';

import * as argon2 from 'argon2';

describe('Dashboard to Backend E2E Integration Suite', () => {
  const businessId = 'biz_test_shop_101';
  const staffUserId1 = 'staff_jane_01';
  const staffUserId2 = 'staff_john_02';

  let mockPrisma: any;
  let mockRedis: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockOutboundService: any;
  let mockEventBus: any;

  let authService: AuthService;
  let conversationService: ConversationManagementService;
  let orderService: OrderService;
  let orderTransitionService: OrderTransitionService;
  let bookingService: BookingService;

  beforeEach(() => {
    mockPrisma = {
      staffUser: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      conversation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      booking: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(1),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock_jwt_access_token_xyz'),
      verify: jest.fn().mockReturnValue({ sub: staffUserId1, businessId }),
    };

    mockConfigService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return def;
      }),
    };

    mockOutboundService = {
      sendText: jest.fn().mockResolvedValue({ id: 'wamid.outbound_01' }),
      sendButtons: jest.fn().mockResolvedValue({}),
    };

    mockEventBus = {
      publishEvent: jest.fn().mockResolvedValue({}),
      getEventStream: jest.fn(),
    };

    authService = new AuthService(mockPrisma, mockRedis, mockJwtService, mockConfigService);
    conversationService = new ConversationManagementService(mockPrisma, mockOutboundService, mockEventBus);
    orderTransitionService = new OrderTransitionService();
    orderService = new OrderService(mockPrisma, null as any, orderTransitionService, mockOutboundService, mockEventBus);
    bookingService = new BookingService(mockPrisma, mockOutboundService, mockEventBus);
  });

  describe('1. Staff Authentication & Refresh', () => {
    it('should authenticate staff user and return JWT access token', async () => {
      const passwordHash = await argon2.hash('Password123!');
      
      mockPrisma.staffUser.findUnique.mockResolvedValue({
        id: staffUserId1,
        businessId,
        email: 'jane@shop.com',
        passwordHash,
        name: 'Jane Doe',
        role: 'OWNER',
        business: { id: businessId, name: 'Acme Shop' },
      });

      const result = await authService.login({ email: 'jane@shop.com', password: 'Password123!' }, '127.0.0.1');

      expect(result.accessToken).toBe('mock_jwt_access_token_xyz');
      expect(result.user.id).toBe(staffUserId1);
      expect(result.user.email).toBe('jane@shop.com');
      expect(result.refreshToken).toBeDefined();
    });

    it('should refresh token when valid refreshToken cookie is presented', async () => {
      const token = 'valid_refresh_token_abc';
      const refreshTokenHash = await argon2.hash(token);

      mockPrisma.staffUser.findMany.mockResolvedValue([
        {
          id: staffUserId1,
          businessId,
          email: 'jane@shop.com',
          name: 'Jane Doe',
          role: 'OWNER',
          refreshTokenHash,
          business: { id: businessId, name: 'Acme Shop' },
        },
      ]);

      const refreshResult = await authService.refreshToken(token);
      expect(refreshResult.accessToken).toBe('mock_jwt_access_token_xyz');
      expect(refreshResult.user.id).toBe(staffUserId1);
    });

    it('should throw UnauthorizedException when invalid refresh token is used', async () => {
      mockPrisma.staffUser.findMany.mockResolvedValue([]);

      await expect(authService.refreshToken('invalid_or_expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('2. Conversations Inbox & Staff Takeover / Reply / Handback', () => {
    it('should list conversations with status and search filters', async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv_1',
          businessId,
          customerId: 'cust_1',
          status: ConversationStatus.BOT,
          customer: { name: 'Alice', phoneNumber: '+234 *** *** 1111' },
          messages: [{ content: 'Hello' }],
        },
      ]);

      const result = await conversationService.listConversations(businessId, {
        status: ConversationStatus.BOT,
        search: 'Alice',
        limit: 10,
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('conv_1');
    });

    it('should take over conversation and assign to staff member', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv_1',
        businessId,
        status: ConversationStatus.BOT,
        assignedStaffId: null,
      });

      mockPrisma.conversation.update.mockResolvedValue({
        id: 'conv_1',
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: staffUserId1,
        assignedStaff: { id: staffUserId1, name: 'Jane' },
      });

      const takenOver = await conversationService.takeOver(businessId, 'conv_1', staffUserId1);

      expect(takenOver.status).toBe(ConversationStatus.HUMAN_HANDLING);
      expect(takenOver.assignedStaffId).toBe(staffUserId1);
      expect(mockEventBus.publishEvent).toHaveBeenCalledWith(
        'conversation.claimed',
        businessId,
        expect.objectContaining({ staffUserId: staffUserId1 }),
      );
    });

    it('should allow assigned staff member to reply to WhatsApp customer within 24h window', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv_1',
        businessId,
        customerId: 'cust_1',
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: staffUserId1,
        windowExpiresAt: new Date(Date.now() + 1000 * 60 * 60), // Valid 1 hr left
        customer: { phoneNumber: '+2348012345678' },
      });

      await conversationService.sendStaffReply(
        businessId,
        'conv_1',
        staffUserId1,
        'Hi Alice, we have dispatched your package.',
      );

      expect(mockOutboundService.sendText).toHaveBeenCalledWith(
        businessId,
        'conv_1',
        'cust_1',
        '+2348012345678',
        'Hi Alice, we have dispatched your package.',
        staffUserId1,
      );
    });

    it('should throw 409 Conflict when another staff member tries to reply without taking over', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv_1',
        businessId,
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: staffUserId1, // Assigned to Jane
      });

      // John (staffUserId2) attempts to reply
      await expect(
        conversationService.sendStaffReply(
          businessId,
          'conv_1',
          staffUserId2,
          'Unauthorized staff reply attempt',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw 400 BadRequest when replying outside the 24-hour customer care window', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv_1',
        businessId,
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: staffUserId1,
        windowExpiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
        customer: { phoneNumber: '+2348012345678' },
      });

      await expect(
        conversationService.sendStaffReply(
          businessId,
          'conv_1',
          staffUserId1,
          'Reply after window expired',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should hand conversation back to automated bot', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv_1',
        businessId,
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: staffUserId1,
      });

      mockPrisma.conversation.update.mockResolvedValue({
        id: 'conv_1',
        status: ConversationStatus.BOT,
        assignedStaffId: null,
      });

      const handedBack = await conversationService.handBack(businessId, 'conv_1');

      expect(handedBack.status).toBe(ConversationStatus.BOT);
      expect(handedBack.assignedStaffId).toBeNull();
      expect(mockEventBus.publishEvent).toHaveBeenCalledWith(
        'conversation.updated',
        businessId,
        expect.objectContaining({ status: ConversationStatus.BOT }),
      );
    });
  });

  describe('3. Order Status State Machine Transitions', () => {
    it('should execute valid transition: PENDING -> PAID -> PREPARING -> COMPLETED', async () => {
      mockPrisma.order.findFirst
        .mockResolvedValueOnce({ id: 'ord_1', businessId, status: OrderStatus.PENDING, currency: 'NGN', totalAmount: 10000 })
        .mockResolvedValueOnce({ id: 'ord_1', businessId, status: OrderStatus.PAID, currency: 'NGN', totalAmount: 10000 })
        .mockResolvedValueOnce({ id: 'ord_1', businessId, status: OrderStatus.PREPARING, currency: 'NGN', totalAmount: 10000 });

      mockPrisma.order.update
        .mockResolvedValueOnce({ id: 'ord_1', status: OrderStatus.PAID })
        .mockResolvedValueOnce({ id: 'ord_1', status: OrderStatus.PREPARING })
        .mockResolvedValueOnce({ id: 'ord_1', status: OrderStatus.COMPLETED });

      const paid = await orderService.updateOrderStatus(businessId, 'ord_1', OrderStatus.PAID, false);
      expect(paid.status).toBe(OrderStatus.PAID);

      const prep = await orderService.updateOrderStatus(businessId, 'ord_1', OrderStatus.PREPARING, false);
      expect(prep.status).toBe(OrderStatus.PREPARING);

      const comp = await orderService.updateOrderStatus(businessId, 'ord_1', OrderStatus.COMPLETED, false);
      expect(comp.status).toBe(OrderStatus.COMPLETED);
    });

    it('should reject invalid transition: PENDING -> COMPLETED', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord_1',
        businessId,
        status: OrderStatus.PENDING,
      });

      await expect(
        orderService.updateOrderStatus(businessId, 'ord_1', OrderStatus.COMPLETED, false),
      ).rejects.toThrow(/Cannot transition order/i);
    });
  });

  describe('4. Booking Cancellation & Rescheduling', () => {
    it('should cancel booking and notify customer', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'bk_1',
        businessId,
        customerId: 'cust_1',
        conversationId: 'conv_1',
        serviceName: 'Consultation',
        startTime: new Date('2026-10-15T10:00:00Z'),
        status: BookingStatus.CONFIRMED,
        customer: { phoneNumber: '+2348012345678' },
      });

      mockPrisma.booking.update.mockResolvedValue({
        id: 'bk_1',
        status: BookingStatus.CANCELLED,
      });

      const cancelled = await bookingService.cancelBooking(businessId, 'bk_1');

      expect(cancelled.status).toBe(BookingStatus.CANCELLED);
      expect(mockEventBus.publishEvent).toHaveBeenCalledWith(
        'booking.updated',
        businessId,
        expect.objectContaining({ status: BookingStatus.CANCELLED }),
      );
      expect(mockOutboundService.sendText).toHaveBeenCalled();
    });

    it('should reschedule booking slot', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'bk_1',
        businessId,
        customerId: 'cust_1',
        conversationId: 'conv_1',
        serviceName: 'Consultation',
        startTime: new Date('2026-10-15T10:00:00Z'),
        customer: { phoneNumber: '+2348012345678' },
      });

      // No overlapping booking
      jest.spyOn(bookingService, 'hasOverlap').mockResolvedValue(false);

      const newStart = new Date('2026-10-16T14:00:00Z');
      const newEnd = new Date('2026-10-16T15:00:00Z');

      mockPrisma.booking.update.mockResolvedValue({
        id: 'bk_1',
        startTime: newStart,
        endTime: newEnd,
        status: BookingStatus.CONFIRMED,
      });

      const rescheduled = await bookingService.rescheduleBooking(businessId, 'bk_1', newStart, newEnd);

      expect(rescheduled.startTime).toEqual(newStart);
      expect(mockEventBus.publishEvent).toHaveBeenCalledWith(
        'booking.updated',
        businessId,
        expect.objectContaining({ startTime: newStart }),
      );
    });
  });
});
