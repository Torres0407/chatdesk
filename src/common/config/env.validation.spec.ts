import { validateEnv } from './env.validation';

describe('EnvValidation', () => {
  const validBaseConfig = {
    NODE_ENV: 'test',
    PORT: '3000',
    API_PREFIX: 'api/v1',
    CORS_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/chatdesk?schema=public',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'super-secret-jwt-key-min-16-chars',
    JWT_ACCESS_EXPIRATION: '15m',
    JWT_REFRESH_SECRET: 'super-secret-refresh-key-min-16-chars',
    JWT_REFRESH_EXPIRATION: '7d',
    META_WEBHOOK_VERIFY_TOKEN: 'chatdesk_wa_verify_token_secure',
    META_APP_SECRET: 'meta_app_secret_12345',
  };

  it('should validate valid environment configuration successfully', () => {
    const config = validateEnv(validBaseConfig);
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_URL).toBe(validBaseConfig.DATABASE_URL);
  });

  it('should fail if JWT_SECRET is too short', () => {
    expect(() => {
      validateEnv({
        ...validBaseConfig,
        JWT_SECRET: 'short',
      });
    }).toThrow();
  });

  it('should fail if DATABASE_URL is missing or invalid', () => {
    expect(() => {
      validateEnv({
        ...validBaseConfig,
        DATABASE_URL: 'not-a-valid-url',
      });
    }).toThrow();
  });
});
