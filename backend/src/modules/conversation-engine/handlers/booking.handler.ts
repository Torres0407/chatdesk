import { Injectable, Logger } from '@nestjs/common';
import { BookingService, DoubleBookingException } from '../../bookings/services/booking.service';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { ConversationState } from '../constants/conversation-state.enum';

@Injectable()
export class BookingHandler {
  private readonly logger = new Logger(BookingHandler.name);

  constructor(
    private readonly bookingService: BookingService,
    private readonly stateService: ConversationStateService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async startBookingFlow(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
  ): Promise<void> {
    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.BOOKING_DATE,
      { serviceName: 'Standard Appointment' },
    );

    // Build 3 date options: Today, Tomorrow, Day After Tomorrow
    const dates: Array<{ dateStr: string; label: string }> = [];
    const now = new Date();

    for (let i = 0; i < 3; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      const label =
        i === 0
          ? 'Today'
          : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dates.push({ dateStr: isoDate, label });
    }

    const buttons = dates.map((d) => ({
      id: `bdate_${d.dateStr}`,
      title: d.label.substring(0, 20),
    }));

    await this.outboundService.sendButtons(
      businessId,
      conversationId,
      customerId,
      customerPhone,
      '📅 *Book an Appointment*\nPlease select your preferred date:',
      buttons,
      {
        footerText: 'Chatdesk Booking Assistant',
      },
    );
  }

  async handleDateSelection(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    selectedDateStr: string,
  ): Promise<void> {
    const cleanDate = selectedDateStr.replace(/^bdate_/, '');
    const dateObj = new Date(`${cleanDate}T00:00:00.000Z`);

    await this.stateService.updateMetadata(businessId, customerId, {
      selectedDate: cleanDate,
    });

    await this.stateService.setState(
      businessId,
      customerId,
      ConversationState.BOOKING_TIME,
    );

    // Get real-time available slots for this date
    const slots = await this.bookingService.getAvailableSlots(businessId, dateObj);
    const availableSlots = slots.filter((s) => s.isAvailable);

    if (availableSlots.length === 0) {
      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        `⚠️ All slots on *${cleanDate}* are currently fully booked. Please choose another date:`,
        [
          { id: 'btn_booking', title: '📅 Choose Another Date' },
          { id: 'btn_menu', title: '🏠 Main Menu' },
        ],
      );
      return;
    }

    // WhatsApp buttons max 3, or list for more
    if (availableSlots.length <= 3) {
      const buttons = availableSlots.map((s) => ({
        id: `btime_${s.startTime.toISOString()}`,
        title: s.label,
      }));

      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        `🕒 Select your preferred time on *${cleanDate}*:`,
        buttons,
      );
    } else {
      const rows = availableSlots.map((s) => ({
        id: `btime_${s.startTime.toISOString()}`,
        title: s.label,
        description: '1 hour session',
      }));

      await this.outboundService.sendList(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        `🕒 Available time slots for *${cleanDate}*:`,
        'Select Time',
        [{ title: 'Available Slots', rows }],
      );
    }
  }

  async handleTimeSelection(
    businessId: string,
    conversationId: string,
    customerId: string,
    customerPhone: string,
    slotIso: string,
  ): Promise<void> {
    const cleanIso = slotIso.replace(/^btime_/, '');
    const startTime = new Date(cleanIso);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const session = await this.stateService.getState(businessId, customerId);
    const serviceName = session.metadata?.serviceName || 'General Appointment';

    try {
      const booking = await this.bookingService.createBooking(
        businessId,
        customerId,
        conversationId,
        serviceName,
        startTime,
        endTime,
      );

      // Reset state back to MAIN_MENU
      await this.stateService.setState(
        businessId,
        customerId,
        ConversationState.MAIN_MENU,
        {},
      );

      const formattedDate = startTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = startTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      const bodyText = `🎉 *Booking Confirmed!*\n\n📋 *Service:* ${serviceName}\n📅 *Date:* ${formattedDate}\n🕒 *Time:* ${formattedTime}\n📊 *Status:* CONFIRMED\n\nWe look forward to serving you!`;

      await this.outboundService.sendButtons(
        businessId,
        conversationId,
        customerId,
        customerPhone,
        bodyText,
        [
          { id: 'btn_menu', title: '🏠 Main Menu' },
          { id: 'btn_agent', title: '👤 Talk to Staff' },
        ],
      );
    } catch (err: any) {
      if (err instanceof DoubleBookingException) {
        await this.outboundService.sendButtons(
          businessId,
          conversationId,
          customerId,
          customerPhone,
          '⚠️ Sorry, that slot was just booked by another customer. Please select another time:',
          [
            { id: 'btn_booking', title: '📅 Select New Time' },
            { id: 'btn_menu', title: '🏠 Main Menu' },
          ],
        );
      } else {
        throw err;
      }
    }
  }
}
