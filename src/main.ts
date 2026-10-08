import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PhoneMaskInterceptor } from './common/interceptors/phone-mask.interceptor';

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Native raw body support in NestJS
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:5173');

  // Middleware for rawBody capture fallback (express)
  app.use(
    express.json({
      verify: (req: RequestWithRawBody, _res: Response, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      verify: (req: RequestWithRawBody, _res: Response, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());

  // Global filters, interceptors, and pipes
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new PhoneMaskInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS Configuration
  app.enableCors({
    origin: corsOrigin.includes(',') ? corsOrigin.split(',').map((o) => o.trim()) : corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  // OpenAPI Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('chatdesk-wa API')
    .setDescription('WhatsApp Business Bot & Staff Dashboard API for small shops and service businesses')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT Access Token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'System health checks')
    .addTag('Webhooks', 'Meta WhatsApp Cloud API Webhooks')
    .addTag('Auth', 'Staff authentication and session management')
    .addTag('Conversations', 'WhatsApp customer conversations & live staff handoff')
    .addTag('Orders', 'E-commerce orders and status tracking')
    .addTag('Bookings', 'Appointment bookings with double-booking prevention')
    .addTag('Products', 'Business product catalog management')
    .addTag('FAQs', 'Frequently Asked Questions and automated answers')
    .addTag('Settings', 'Business configuration, operating hours, and opt-outs')
    .addTag('Events', 'Real-time Server-Sent Events (SSE)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  logger.log(`🚀 chatdesk-wa server running on http://localhost:${port}`);
  logger.log(`📚 OpenAPI Documentation available at http://localhost:${port}/docs`);
}

bootstrap();
