import { Injectable, Logger, MessageEvent, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { RedisService } from '../../../redis/redis.service';
import { AppDomainEvent, DomainEventType } from '../dto/events.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly channelSubjects = new Map<string, Subject<AppDomainEvent>>();
  private readonly channelSubscribersCount = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

  onModuleInit() {
    const subscriber = this.redis.getSubscriber();
    if (subscriber) {
      subscriber.on('message', (channel: string, messageStr: string) => {
        try {
          const subject = this.channelSubjects.get(channel);
          if (subject) {
            const event: AppDomainEvent = JSON.parse(messageStr);
            subject.next(event);
          }
        } catch (err: any) {
          this.logger.warn(`Failed to parse pub/sub message on channel ${channel}: ${err.message}`);
        }
      });
    }
  }

  /**
   * Publishes a typed domain event to the tenant-specific Redis Pub/Sub channel.
   */
  async publishEvent<T = any>(
    type: DomainEventType,
    businessId: string,
    data: T,
  ): Promise<AppDomainEvent<T>> {
    const event: AppDomainEvent<T> = {
      id: randomUUID(),
      type,
      businessId,
      timestamp: new Date().toISOString(),
      data,
    };

    const channel = this.getChannelName(businessId);
    await this.redis.publish(channel, JSON.stringify(event));
    this.logger.debug(`Published event ${type} to channel ${channel}`);
    return event;
  }

  /**
   * Creates an Observable stream of Server-Sent Events (SSE) scoped strictly to a given business.
   */
  getEventStream(businessId: string): Observable<MessageEvent> {
    const channel = this.getChannelName(businessId);
    let subject = this.channelSubjects.get(channel);

    if (!subject) {
      subject = new Subject<AppDomainEvent>();
      this.channelSubjects.set(channel, subject);
    }

    const currentCount = this.channelSubscribersCount.get(channel) || 0;
    this.channelSubscribersCount.set(channel, currentCount + 1);

    if (currentCount === 0) {
      this.redis.getSubscriber()?.subscribe(channel).catch((err) => {
        this.logger.warn(`Error subscribing to Redis channel ${channel}: ${err.message}`);
      });
    }

    return new Observable<MessageEvent>((observer) => {
      // 1. Send initial connection confirmation event
      observer.next({
        data: {
          type: 'connected',
          businessId,
          timestamp: new Date().toISOString(),
          message: 'SSE stream established',
        },
        type: 'connected',
      });

      // 2. Subscribe to Redis domain events
      const subscription = subject!.subscribe({
        next: (event) => {
          observer.next({
            id: event.id,
            type: event.type,
            data: event,
          });
        },
        error: (err) => observer.error(err),
      });

      // 3. Heartbeat / ping interval (15s) to keep SSE connection alive
      const pingInterval = setInterval(() => {
        observer.next({
          data: {
            type: 'ping',
            timestamp: new Date().toISOString(),
          },
          type: 'ping',
        });
      }, 15000);

      // 4. Cleanup on client disconnect
      return () => {
        clearInterval(pingInterval);
        subscription.unsubscribe();

        const remainingCount = (this.channelSubscribersCount.get(channel) || 1) - 1;
        if (remainingCount <= 0) {
          this.channelSubscribersCount.delete(channel);
          this.channelSubjects.delete(channel);
          this.redis.getSubscriber()?.unsubscribe(channel).catch(() => {});
        } else {
          this.channelSubscribersCount.set(channel, remainingCount);
        }
        this.logger.debug(`SSE client disconnected from ${channel} (remaining: ${Math.max(0, remainingCount)})`);
      };
    });
  }

  private getChannelName(businessId: string): string {
    return `events:business:${businessId}`;
  }

  async onModuleDestroy() {
    for (const [channel, subject] of this.channelSubjects.entries()) {
      subject.complete();
    }
    this.channelSubjects.clear();
    this.channelSubscribersCount.clear();
  }
}
