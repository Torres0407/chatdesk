import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentService } from './services/payment.service';
import { PaystackPaymentProvider } from './providers/paystack-payment.provider';
import { PaystackSignatureGuard } from './guards/paystack-signature.guard';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [PrismaModule, RedisModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentService,
    PaystackPaymentProvider,
    PaystackSignatureGuard,
    {
      provide: PAYMENT_PROVIDER,
      useClass: PaystackPaymentProvider,
    },
  ],
  exports: [PaymentService, PaystackPaymentProvider, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
