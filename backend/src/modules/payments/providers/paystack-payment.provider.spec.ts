import { PaystackPaymentProvider } from './paystack-payment.provider';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('PaystackPaymentProvider', () => {
  let provider: PaystackPaymentProvider;
  let mockConfigService: any;
  const secretKey = 'sk_test_mock_secret_key_123';

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'PAYSTACK_SECRET_KEY') return secretKey;
        if (key === 'PAYSTACK_WEBHOOK_SECRET') return secretKey;
        if (key === 'NODE_ENV') return 'test';
        return null;
      }),
    };
    provider = new PaystackPaymentProvider(mockConfigService as ConfigService);
  });

  describe('initializePayment', () => {
    it('should initialize payment and return authorization URL and reference', async () => {
      const res = await provider.initializePayment({
        businessId: 'biz-1',
        orderId: 'ord-101',
        amount: 15000,
        currency: 'NGN',
        email: 'customer@example.com',
      });

      expect(res.authorizationUrl).toContain('https://checkout.paystack.com/');
      expect(res.reference).toContain('cd_ord-101_');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for valid HMAC SHA512 signature computed on raw body', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123' } });
      const rawBody = Buffer.from(payload, 'utf8');

      const validSignature = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody)
        .digest('hex');

      const isValid = provider.verifyWebhookSignature(rawBody, validSignature);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      const rawBody = Buffer.from(payload, 'utf8');

      const isValid = provider.verifyWebhookSignature(rawBody, 'invalid_hex_signature');
      expect(isValid).toBe(false);
    });

    it('should return false when signature or body is missing', () => {
      expect(provider.verifyWebhookSignature(Buffer.from(''), '')).toBe(false);
    });
  });
});
