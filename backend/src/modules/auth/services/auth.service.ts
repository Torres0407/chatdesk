import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { LoginDto, LoginResponseDto, JwtPayload } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async checkRateLimit(identifier: string): Promise<void> {
    const key = `ratelimit:login:${identifier}`;
    const attempts = await this.redis.get(key);
    const count = attempts ? parseInt(attempts, 10) : 0;

    if (count >= 5) {
      throw new HttpException(
        'Too many failed login attempts. Please try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailedAttempt(identifier: string): Promise<void> {
    const key = `ratelimit:login:${identifier}`;
    const attempts = await this.redis.get(key);
    const count = attempts ? parseInt(attempts, 10) + 1 : 1;
    await this.redis.set(key, count.toString(), 900); // 15 min TTL
  }

  async clearRateLimit(identifier: string): Promise<void> {
    const key = `ratelimit:login:${identifier}`;
    await this.redis.del(key);
  }

  async login(
    loginDto: LoginDto,
    ipAddress: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const rateLimitKey = `${ipAddress}:${loginDto.email.toLowerCase()}`;
    await this.checkRateLimit(rateLimitKey);

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
      include: { business: true },
    });

    if (!staffUser) {
      await this.recordFailedAttempt(rateLimitKey);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(
      staffUser.passwordHash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      await this.recordFailedAttempt(rateLimitKey);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.clearRateLimit(rateLimitKey);

    // 1. Generate JWT Access Token (15m)
    const payload: JwtPayload = {
      sub: staffUser.id,
      email: staffUser.email,
      businessId: staffUser.businessId,
      role: staffUser.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    });

    // 2. Generate Rotating Refresh Token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = await argon2.hash(refreshToken);

    await this.prisma.staffUser.update({
      where: { id: staffUser.id },
      data: { refreshTokenHash },
    });

    this.logger.log(`Staff user ${staffUser.email} logged in successfully`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: staffUser.id,
        businessId: staffUser.businessId,
        email: staffUser.email,
        name: staffUser.name,
        role: staffUser.role,
        businessName: staffUser.business.name,
      },
    };
  }

  async refreshToken(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; newRefreshToken: string; user: any }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    // Find all users with refresh tokens to check (or extract user if structured)
    const users = await this.prisma.staffUser.findMany({
      where: { refreshTokenHash: { not: null } },
      include: { business: true },
    });

    let matchedUser = null;
    for (const user of users) {
      if (user.refreshTokenHash) {
        const isMatch = await argon2.verify(user.refreshTokenHash, rawRefreshToken);
        if (isMatch) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = await argon2.hash(newRefreshToken);

    await this.prisma.staffUser.update({
      where: { id: matchedUser.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    const payload: JwtPayload = {
      sub: matchedUser.id,
      email: matchedUser.email,
      businessId: matchedUser.businessId,
      role: matchedUser.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    });

    return {
      accessToken,
      newRefreshToken,
      user: {
        id: matchedUser.id,
        businessId: matchedUser.businessId,
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
        businessName: matchedUser.business.name,
      },
    };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.staffUser.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async getMe(userId: string): Promise<any> {
    const staffUser = await this.prisma.staffUser.findUnique({
      where: { id: userId },
      include: { business: true },
    });

    if (!staffUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: staffUser.id,
      businessId: staffUser.businessId,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
      businessName: staffUser.business.name,
      businessCurrency: staffUser.business.currency,
      businessTimezone: staffUser.business.timezone,
    };
  }
}
