import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private subscriber!: Redis;
  private publisher!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    };

    this.client = new Redis(redisUrl, redisOptions);
    this.subscriber = new Redis(redisUrl, redisOptions);
    this.publisher = new Redis(redisUrl, redisOptions);

    this.client.on('connect', () => this.logger.log('Redis client connected'));
    this.client.on('error', (err) => this.logger.warn(`Redis connection error: ${err.message}`));

    // Connect lazily
    this.client.connect().catch((err) => this.logger.warn(`Redis client lazy connect: ${err.message}`));
    this.subscriber.connect().catch((err) => this.logger.warn(`Redis subscriber lazy connect: ${err.message}`));
    this.publisher.connect().catch((err) => this.logger.warn(`Redis publisher lazy connect: ${err.message}`));
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err: any) {
      this.logger.warn(`Redis set error for key ${key}: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis del error for key ${key}: ${err.message}`);
    }
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return true; // Fallback gracefully if Redis is temporarily offline
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.publisher.publish(channel, message);
    } catch {
      return 0;
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.client?.quit(),
      this.subscriber?.quit(),
      this.publisher?.quit(),
    ]);
  }
}
