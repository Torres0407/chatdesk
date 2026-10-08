import { PaystackSignatureGuard } from './paystack-signature.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('PaystackSignatureGuard', () => {
  let guard: PaystackSignatureGuard;
  let mockPaymentProvider: any;

  beforeEach(() => {
    mockPaymentProvider = {
      verifyWebhookSignature: jest.fn(),
    };
    guard = new PaystackSignatureGuard(mockPaymentProvider);
  });

  const createMockContext = (headers: Record<string, string>, rawBody?: Buffer) => {
    const req: any = {
      headers,
      rawBody,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;
  };

  it('should throw UnauthorizedException when x-paystack-signature header is missing', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Missing Paystack signature header'),
    );
  });

  it('should throw UnauthorizedException when rawBody is missing', () => {
    const context = createMockContext({ 'x-paystack-signature': 'sig_123' });
    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Invalid raw body format'),
    );
  });

  it('should throw UnauthorizedException when signature verification fails', () => {
    mockPaymentProvider.verifyWebhookSignature.mockReturnValue(false);
    const context = createMockContext(
      { 'x-paystack-signature': 'wrong_sig' },
      Buffer.from('{"test":1}'),
    );

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Invalid Paystack signature'),
    );
  });

  it('should allow request when signature verification succeeds', () => {
    mockPaymentProvider.verifyWebhookSignature.mockReturnValue(true);
    const context = createMockContext(
      { 'x-paystack-signature': 'valid_sig' },
      Buffer.from('{"test":1}'),
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
