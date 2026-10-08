import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),

  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1, 'META_WEBHOOK_VERIFY_TOKEN is required'),
  META_APP_SECRET: z.string().min(1, 'META_APP_SECRET is required'),
  META_API_VERSION: z.string().default('v21.0'),
  META_API_BASE_URL: z.string().url().default('https://graph.facebook.com'),

  PAYSTACK_SECRET_KEY: z.string().default('sk_test_mock'),
  PAYSTACK_WEBHOOK_SECRET: z.string().default('sk_test_mock'),

  OPENAI_API_KEY: z.string().optional().default(''),
  AI_FAQ_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errorDetails = parsed.error.format();
    console.error('❌ Environment validation failed:', JSON.stringify(errorDetails, null, 2));
    throw new Error(`Environment validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}
