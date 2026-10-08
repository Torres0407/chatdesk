import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../dto/auth.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'default_jwt_secret_key_123',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.businessId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { id: payload.sub },
      include: { business: true },
    });

    if (!staffUser || staffUser.businessId !== payload.businessId) {
      throw new UnauthorizedException('User no longer exists or business mismatch');
    }

    return {
      userId: staffUser.id,
      sub: staffUser.id,
      email: staffUser.email,
      businessId: staffUser.businessId,
      role: staffUser.role,
      name: staffUser.name,
      businessName: staffUser.business.name,
    };
  }
}
