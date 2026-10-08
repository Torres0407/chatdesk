import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { maskPhoneNumber } from '../utils/phone-mask.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message || res;
        errorCode = (res as any).error || (res as any).code || errorCode;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log sanitized error details without message bodies or raw sensitive data
    const sanitizedUrl = request?.url ? request.url.replace(/\+?[0-9]{7,15}/g, (match) => maskPhoneNumber(match)) : 'unknown';
    this.logger.error(
      `[${request?.method}] ${sanitizedUrl} -> Status ${status} | Error: ${typeof message === 'object' ? JSON.stringify(message) : message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: sanitizedUrl,
    });
  }
}
