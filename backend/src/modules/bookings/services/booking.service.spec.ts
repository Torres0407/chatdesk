import { BookingService, DoubleBookingException } from './booking.service';
import { BookingStatus } from '@prisma/client';

describe('BookingService', () => {
  let service: BookingService;
  let mockPrisma: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockPrisma = {
      booking: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
    };
    mockOutboundService = {
      sendText: jest.fn(),
    };

    service = new BookingService(mockPrisma, mockOutboundService);
  });

  describe('createBooking', () => {
    it('should create booking when no conflict exists', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue({
        id: 'bk-123',
        businessId: 'biz-1',
        serviceName: 'Consultation',
        startTime: new Date('2026-10-10T10:00:00.000Z'),
        endTime: new Date('2026-10-10T11:00:00.000Z'),
        status: BookingStatus.CONFIRMED,
      });

      const booking = await service.createBooking(
        'biz-1',
        'cust-1',
        'conv-1',
        'Consultation',
        new Date('2026-10-10T10:00:00.000Z'),
        new Date('2026-10-10T11:00:00.000Z'),
      );

      expect(booking.id).toBe('bk-123');
      expect(booking.status).toBe(BookingStatus.CONFIRMED);
    });

    it('should throw DoubleBookingException when overlapping active booking exists', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'existing-bk',
        startTime: new Date('2026-10-10T10:00:00.000Z'),
        endTime: new Date('2026-10-10T11:00:00.000Z'),
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        service.createBooking(
          'biz-1',
          'cust-1',
          'conv-1',
          'Consultation',
          new Date('2026-10-10T10:30:00.000Z'),
          new Date('2026-10-10T11:30:00.000Z'),
        ),
      ).rejects.toThrow(DoubleBookingException);
    });
  });

  describe('getAvailableSlots', () => {
    it('should mark slots as unavailable if an overlapping booking exists', async () => {
      // Return overlap for 11:00 AM slot
      mockPrisma.booking.findFirst.mockImplementation((query: any) => {
        const start = query.where.AND[1].endTime.gt;
        if (new Date(start).getHours() === 11) {
          return Promise.resolve({ id: 'bk-booked' });
        }
        return Promise.resolve(null);
      });

      const slots = await service.getAvailableSlots('biz-1', new Date('2026-10-10'));

      expect(slots.length).toBe(5);
      const slot11 = slots.find((s) => s.label === '11:00 AM');
      expect(slot11?.isAvailable).toBe(false);

      const slot9 = slots.find((s) => s.label === '9:00 AM');
      expect(slot9?.isAvailable).toBe(true);
    });
  });

  describe('cancelBooking', () => {
    it('should update status to CANCELLED and notify customer', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'bk-123',
        businessId: 'biz-1',
        customerId: 'cust-1',
        conversationId: 'conv-1',
        serviceName: 'Consultation',
        startTime: new Date('2026-10-10T10:00:00.000Z'),
        customer: { phoneNumber: '+2348012345678' },
      });

      mockPrisma.booking.update.mockResolvedValue({
        id: 'bk-123',
        status: BookingStatus.CANCELLED,
      });

      const res = await service.cancelBooking('biz-1', 'bk-123');

      expect(res.status).toBe(BookingStatus.CANCELLED);
      expect(mockOutboundService.sendText).toHaveBeenCalledWith(
        'biz-1',
        'conv-1',
        'cust-1',
        '+2348012345678',
        expect.stringContaining('has been cancelled'),
      );
    });
  });

  describe('rescheduleBooking', () => {
    it('should reject reschedule if new slot conflicts', async () => {
      mockPrisma.booking.findFirst
        .mockResolvedValueOnce({
          id: 'bk-123',
          businessId: 'biz-1',
          serviceName: 'Consultation',
        })
        .mockResolvedValueOnce({
          id: 'other-bk',
          status: BookingStatus.CONFIRMED,
        });

      await expect(
        service.rescheduleBooking(
          'biz-1',
          'bk-123',
          new Date('2026-10-12T10:00:00.000Z'),
          new Date('2026-10-12T11:00:00.000Z'),
        ),
      ).rejects.toThrow(DoubleBookingException);
    });
  });
});
