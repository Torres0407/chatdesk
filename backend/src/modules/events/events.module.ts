import { Module, Global } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventBusService } from './services/event-bus.service';
import { RedisModule } from '../../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  controllers: [EventsController],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
