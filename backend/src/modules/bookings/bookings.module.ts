import { Module } from '@nestjs/common';
import { BookingService } from './services/booking.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { OutboundMessageModule } from '../outbound-message/outbound-message.module';

@Module({
  imports: [PrismaModule, OutboundMessageModule],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingsModule {}
