import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: any;
  let redisService: any;

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockImplementation((checks) => Promise.all(checks.map((c: any) => c()))),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return healthy status when DB and Redis are up', async () => {
    const res = await controller.checkRootHealth();
    expect(res.status).toBe('ok');
    expect(res.details.database.status).toBe('up');
    expect(res.details.redis.status).toBe('up');
  });

  it('should return api v1 health status', async () => {
    const res = await controller.checkApiHealth();
    expect(res.status).toBe('ok');
  });
});
