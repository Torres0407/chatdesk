import { AuthService } from './auth.service';
import { UnauthorizedException, HttpException } from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      staffUser: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock_jwt_access_token'),
    };
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test_jwt_secret_123';
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        return null;
      }),
    };

    service = new AuthService(
      mockPrisma,
      mockRedis,
      mockJwtService,
      mockConfigService,
    );
  });

  describe('login', () => {
    it('should throw UnauthorizedException when staff user is not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.staffUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@test.com', password: 'password123' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw TooManyRequests exception when rate limit is exceeded', async () => {
      mockRedis.get.mockResolvedValue('5'); // 5 failed attempts

      await expect(
        service.login({ email: 'staff@test.com', password: 'password123' }, '127.0.0.1'),
      ).rejects.toThrow(HttpException);
    });

    it('should successfully log in and return accessToken + rotating refreshToken', async () => {
      mockRedis.get.mockResolvedValue(null);
      const passwordHash = await argon2.hash('SecretPass123!');

      mockPrisma.staffUser.findUnique.mockResolvedValue({
        id: 'usr-1',
        businessId: 'biz-1',
        email: 'staff@test.com',
        name: 'John Staff',
        role: 'STAFF',
        passwordHash,
        business: { name: 'Acme Supermarket' },
      });

      const res = await service.login(
        { email: 'staff@test.com', password: 'SecretPass123!' },
        '127.0.0.1',
      );

      expect(res.accessToken).toBe('mock_jwt_access_token');
      expect(res.refreshToken).toBeDefined();
      expect(res.user.email).toBe('staff@test.com');
      expect(mockPrisma.staffUser.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: expect.objectContaining({ refreshTokenHash: expect.any(String) }),
      });
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash in DB', async () => {
      await service.logout('usr-1');

      expect(mockPrisma.staffUser.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: { refreshTokenHash: null },
      });
    });
  });
});
