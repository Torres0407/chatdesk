import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';

export class DoubleBookingException extends ConflictException {
  constructor(message = 'The selected time slot is already booked. Please choose another time.') {
    super(message);
  }
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  label: string;
  isAvailable: boolean;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async hasOverlap(
    businessId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        businessId,
        status: { not: BookingStatus.CANCELLED },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } },
        ],
      },
    });

    return !!overlapping;
  }

  async getAvailableSlots(businessId: string, date: Date): Promise<TimeSlot[]> {
    const slotHours = [9, 11, 14, 16, 18]; // 9:00, 11:00, 14:00, 16:00, 18:00
    const durationMinutes = 60;

    const slots: TimeSlot[] = [];

    for (const hour of slotHours) {
      const startTime = new Date(date);
      startTime.setHours(hour, 0, 0, 0);

      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
      const isOverlapping = await this.hasOverlap(businessId, startTime, endTime);

      const hourLabel = hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`;

      slots.push({
        startTime,
        endTime,
        label: hourLabel,
        isAvailable: !isOverlapping,
      });
    }

    return slots;
  }

  async createBooking(
    businessId: string,
    customerId: string,
    conversationId: string | null,
    serviceName: string,
    startTime: Date,
    endTime: Date,
    notes?: string,
  ): Promise<any> {
    // 1. Transactional check to prevent race conditions & double-booking
    const booking = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          businessId,
          status: { not: BookingStatus.CANCELLED },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
        },
      });

      if (conflict) {
        throw new DoubleBookingException();
      }

      return tx.booking.create({
        data: {
          businessId,
          customerId,
          conversationId,
          serviceName,
          startTime,
          endTime,
          status: BookingStatus.CONFIRMED,
          notes: notes || null,
        },
        include: {
          customer: true,
        },
      });
    });

    this.logger.log(
      `Created booking id=${booking.id} service="${serviceName}" for business=${businessId}`,
    );

    return booking;
  }

  async cancelBooking(businessId: string, bookingId: string): Promise<any> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      include: { customer: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found.`);
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
      include: { customer: true },
    });

    this.logger.log(`Cancelled booking id=${bookingId} for business=${businessId}`);

    // Notify customer on WhatsApp if conversation exists
    if (booking.conversationId && booking.customer?.phoneNumber) {
      const formattedDate = new Date(booking.startTime).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = new Date(booking.startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      await this.outboundService.sendText(
        businessId,
        booking.conversationId,
        booking.customerId,
        booking.customer.phoneNumber,
        `❌ Your booking for *${booking.serviceName}* on ${formattedDate} at ${formattedTime} has been cancelled.`,
      );
    }

    return updated;
  }

  async rescheduleBooking(
    businessId: string,
    bookingId: string,
    newStartTime: Date,
    newEndTime: Date,
  ): Promise<any> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      include: { customer: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found.`);
    }

    const hasConflict = await this.hasOverlap(
      businessId,
      newStartTime,
      newEndTime,
      bookingId,
    );

    if (hasConflict) {
      throw new DoubleBookingException('The new time slot is unavailable. Please choose another slot.');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
        status: BookingStatus.CONFIRMED,
      },
      include: { customer: true },
    });

    this.logger.log(`Rescheduled booking id=${bookingId} to ${newStartTime.toISOString()}`);

    if (booking.conversationId && booking.customer?.phoneNumber) {
      const formattedDate = new Date(newStartTime).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = new Date(newStartTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      await this.outboundService.sendText(
        businessId,
        booking.conversationId,
        booking.customerId,
        booking.customer.phoneNumber,
        `🗓️ Your booking for *${booking.serviceName}* has been rescheduled to *${formattedDate}* at *${formattedTime}*.`,
      );
    }

    return updated;
  }
}
