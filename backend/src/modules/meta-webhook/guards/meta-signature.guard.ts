import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Injectable()
export class MetaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MetaSignatureGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRawBody>();

    // Skip signature check in test environment only if explicitly configured
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const bypassHeader = request.headers['x-bypass-signature-for-test'];
    if (nodeEnv === 'test' && bypassHeader === 'true') {
      return true;
    }

    const signatureHeader = request.headers['x-hub-signature-256'] as string;
    if (!signatureHeader) {
      this.logger.warn('Missing X-Hub-Signature-256 header in webhook request');
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    const appSecret = this.configService.get<string>('META_APP_SECRET');
    if (!appSecret) {
      this.logger.error('META_APP_SECRET is not configured on the server');
      throw new ForbiddenException('Meta app secret is not configured');
    }

    const rawBody = request.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.error('Raw body not captured or invalid buffer for signature verification');
      throw new UnauthorizedException('Unable to verify payload signature: raw body unavailable');
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    try {
      const sigBuffer = Buffer.from(signatureHeader, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        this.logger.warn('Invalid X-Hub-Signature-256 provided');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        throw err;
      }
      this.logger.warn(`Signature verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
