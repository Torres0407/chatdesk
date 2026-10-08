import { BookingHandler } from './booking.handler';
import { ConversationState } from '../constants/conversation-state.enum';
import { DoubleBookingException } from '../../bookings/services/booking.service';

describe('BookingHandler', () => {
  let handler: BookingHandler;
  let mockBookingService: any;
  let mockStateService: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockBookingService = {
      getAvailableSlots: jest.fn(),
      createBooking: jest.fn(),
    };
    mockStateService = {
      setState: jest.fn(),
      updateMetadata: jest.fn(),
      getState: jest.fn().mockResolvedValue({
        state: 'MAIN_MENU',
        metadata: { serviceName: 'Consultation' },
      }),
    };
    mockOutboundService = {
      sendButtons: jest.fn(),
      sendList: jest.fn(),
    };

    handler = new BookingHandler(
      mockBookingService,
      mockStateService,
      mockOutboundService,
    );
  });

  it('should start booking flow and prompt for dates', async () => {
    await handler.startBookingFlow('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockStateService.setState).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      ConversationState.BOOKING_DATE,
      expect.objectContaining({ serviceName: 'Standard Appointment' }),
    );
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('Book an Appointment'),
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('should display available time slots when date is selected', async () => {
    mockBookingService.getAvailableSlots.mockResolvedValue([
      { startTime: new Date('2026-10-10T09:00:00.000Z'), label: '9:00 AM', isAvailable: true },
      { startTime: new Date('2026-10-10T11:00:00.000Z'), label: '11:00 AM', isAvailable: true },
    ]);

    await handler.handleDateSelection(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      'bdate_2026-10-10',
    );

    expect(mockStateService.updateMetadata).toHaveBeenCalledWith('biz-1', 'cust-1', {
      selectedDate: '2026-10-10',
    });
    expect(mockStateService.setState).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      ConversationState.BOOKING_TIME,
    );
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('Select your preferred time'),
      expect.arrayContaining([
        expect.objectContaining({ title: '9:00 AM' }),
      ]),
    );
  });

  it('should confirm booking and return to main menu', async () => {
    mockBookingService.createBooking.mockResolvedValue({
      id: 'bk-999',
      serviceName: 'Consultation',
      status: 'CONFIRMED',
    });

    await handler.handleTimeSelection(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      'btime_2026-10-10T09:00:00.000Z',
    );

    expect(mockBookingService.createBooking).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      'conv-1',
      'Consultation',
      expect.any(Date),
      expect.any(Date),
    );
    expect(mockStateService.setState).toHaveBeenCalledWith(
      'biz-1',
      'cust-1',
      ConversationState.MAIN_MENU,
      {},
    );
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('Booking Confirmed!'),
      expect.any(Array),
    );
  });

  it('should handle double booking error gracefully', async () => {
    mockBookingService.createBooking.mockRejectedValue(new DoubleBookingException());

    await handler.handleTimeSelection(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      'btime_2026-10-10T09:00:00.000Z',
    );

    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('slot was just booked by another customer'),
      expect.any(Array),
    );
  });
});
