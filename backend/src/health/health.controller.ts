import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'System health check' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  @ApiResponse({ status: 503, description: 'Application is unhealthy' })
  @HealthCheck()
  async checkRootHealth() {
    return this.performHealthChecks();
  }

  @Get('api/v1/health')
  @ApiOperation({ summary: 'API v1 health check' })
  @ApiResponse({ status: 200, description: 'API is healthy' })
  @HealthCheck()
  async checkApiHealth() {
    return this.performHealthChecks();
  }

  private async performHealthChecks() {
    let dbStatus = 'up';
    let redisStatus = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'degraded_or_unreachable';
    }

    try {
      const redisClient = this.redis.getClient();
      if (redisClient) {
        const ping = await redisClient.ping();
        if (ping !== 'PONG') redisStatus = 'degraded';
      }
    } catch {
      redisStatus = 'degraded_or_unreachable';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: {
        database: { status: dbStatus },
        redis: { status: redisStatus },
      },
    };
  }
}
