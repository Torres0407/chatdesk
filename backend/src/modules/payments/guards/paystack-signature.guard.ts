import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PaystackPaymentProvider } from '../providers/paystack-payment.provider';

@Injectable()
export class PaystackSignatureGuard implements CanActivate {
  private readonly logger = new Logger(PaystackSignatureGuard.name);

  constructor(private readonly paymentProvider: PaystackPaymentProvider) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-paystack-signature'] as string;

    if (!signature) {
      this.logger.warn('Missing x-paystack-signature header in webhook request');
      throw new UnauthorizedException('Missing Paystack signature header');
    }

    const rawBody = (request as any).rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.error('Raw body not captured for Paystack webhook signature verification');
      throw new UnauthorizedException('Invalid raw body format');
    }

    const isValid = this.paymentProvider.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      this.logger.warn('Invalid Paystack webhook signature');
      throw new UnauthorizedException('Invalid Paystack signature');
    }

    return true;
  }
}
