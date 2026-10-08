import { Module } from '@nestjs/common';
import { BookingService } from './services/booking.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';

import { BookingsController } from './bookings.controller';

@Module({
  imports: [PrismaModule, OutboundMessageModule],
  controllers: [BookingsController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingsModule {}
