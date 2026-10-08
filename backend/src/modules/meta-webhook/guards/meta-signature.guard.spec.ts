import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MetaSignatureGuard } from './meta-signature.guard';

describe('MetaSignatureGuard', () => {
  let guard: MetaSignatureGuard;
  let configService: ConfigService;
  const appSecret = 'test_meta_app_secret_12345';

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'META_APP_SECRET') return appSecret;
        if (key === 'NODE_ENV') return 'development';
        return null;
      }),
    } as any;
    guard = new MetaSignatureGuard(configService);
  });

  function createMockContext(headers: Record<string, string>, rawBody?: Buffer): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          rawBody,
        }),
      }),
    } as any;
  }

  it('should allow request with valid X-Hub-Signature-256 matching raw body', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
    const signature = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    const context = createMockContext(
      { 'x-hub-signature-256': signature },
      rawBody,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject request with invalid signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
    const invalidSignature = 'sha256=bad_signature_hex_0000000000000000000000000000000000000000000000000000000000000000';

    const context = createMockContext(
      { 'x-hub-signature-256': invalidSignature },
      rawBody,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request with missing signature header', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
    const context = createMockContext({}, rawBody);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request when raw body is missing', () => {
    const context = createMockContext({
      'x-hub-signature-256': 'sha256=1234567890abcdef',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if META_APP_SECRET is not configured', () => {
    (configService.get as jest.Mock).mockReturnValue(null);
    const rawBody = Buffer.from('test');
    const context = createMockContext(
      { 'x-hub-signature-256': 'sha256=1234567890abcdef' },
      rawBody,
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
