import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { validateEnv } from './common/config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { MetaWebhookModule } from './modules/meta-webhook/meta-webhook.module';
import { OutboundMessageModule } from './modules/outbound-message/outbound-message.module';
import { ConversationEngineModule } from './modules/conversation-engine/conversation-engine.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FaqsModule } from './modules/faqs/faqs.module';
import { SettingsModule } from './modules/settings/settings.module';
import { EventsModule } from './modules/events/events.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '.env.local'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    EventsModule,
    HandoffModule,
    AiModule,
    MetaWebhookModule,
    OutboundMessageModule,
    ConversationEngineModule,
    CartModule,
    OrdersModule,
    BookingsModule,
    PaymentsModule,
    AuthModule,
    ConversationsModule,
    CatalogModule,
    FaqsModule,
    SettingsModule,
  ],
})
export class AppModule {}
