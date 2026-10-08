import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  InitializePaymentRequest,
  InitializePaymentResponse,
  VerifyPaymentResponse,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class PaystackPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(PaystackPaymentProvider.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || 'sk_test_mock';
    this.webhookSecret =
      this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET') || this.secretKey;
  }

  async initializePayment(
    request: InitializePaymentRequest,
  ): Promise<InitializePaymentResponse> {
    const isTestOrMock =
      this.configService.get<string>('NODE_ENV') === 'test' ||
      this.secretKey.startsWith('sk_test_mock') ||
      !this.secretKey;

    const reference = `cd_${request.orderId}_${Date.now()}`;
    const amountInKobo = Math.round(request.amount * 100);

    if (isTestOrMock) {
      this.logger.debug(
        `[MOCK Paystack] Initializing payment for order=${request.orderId} amount=${request.amount}`,
      );
      return {
        authorizationUrl: `https://checkout.paystack.com/mock_${reference}`,
        accessCode: `mock_code_${reference}`,
        reference,
      };
    }

    const payload = {
      email: request.email || 'customer@chatdesk.local',
      amount: amountInKobo,
      currency: request.currency || 'NGN',
      reference,
      callback_url: request.callbackUrl,
      metadata: {
        businessId: request.businessId,
        orderId: request.orderId,
        phoneNumber: request.phoneNumber,
        ...(request.metadata || {}),
      },
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Paystack initialize payment error: ${err}`);
      throw new Error(`Paystack error: ${err}`);
    }

    const data = (await response.json()) as any;
    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    const isTestOrMock =
      this.configService.get<string>('NODE_ENV') === 'test' ||
      this.secretKey.startsWith('sk_test_mock');

    if (isTestOrMock) {
      return {
        reference,
        status: 'success',
        amount: 10000,
        currency: 'NGN',
        paidAt: new Date(),
      };
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Paystack verify error: ${err}`);
    }

    const data = (await response.json()) as any;
    return {
      reference: data.data.reference,
      status: data.data.status,
      amount: data.data.amount / 100,
      currency: data.data.currency,
      paidAt: data.data.paid_at ? new Date(data.data.paid_at) : undefined,
      metadata: data.data.metadata,
    };
  }

  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    secret?: string,
  ): boolean {
    const secretKey = secret || this.webhookSecret;
    if (!secretKey || !signature) {
      return false;
    }

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(bodyBuffer)
      .digest('hex');

    try {
      const hashBuffer = Buffer.from(hash, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (hashBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }
}
