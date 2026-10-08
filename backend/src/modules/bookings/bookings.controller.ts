import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BookingService } from './services/booking.service';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export class BookingQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

export class RescheduleBookingDto {
  @ApiProperty({ example: '2026-10-15T14:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ example: '2026-10-15T15:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;
}

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List bookings with from, to, and status filters' })
  async listBookings(
    @CurrentUser('businessId') businessId: string,
    @Query() query: BookingQueryDto,
  ) {
    const where: any = {
      businessId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startTime: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        customer: true,
      },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details by ID' })
  async getBooking(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: { customer: true, conversation: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found.`);
    }

    return booking;
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking and notify customer on WhatsApp' })
  async cancelBooking(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.bookingService.cancelBooking(businessId, id);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reschedule booking slot with double-booking check' })
  async rescheduleBooking(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
    @Body() body: RescheduleBookingDto,
  ) {
    return this.bookingService.rescheduleBooking(
      businessId,
      id,
      new Date(body.startTime),
      new Date(body.endTime),
    );
  }
}
