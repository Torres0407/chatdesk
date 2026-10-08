import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaystackSignatureGuard } from './guards/paystack-signature.guard';
import { PaymentService } from './services/payment.service';
import { PaymentWebhookEvent } from './interfaces/payment-provider.interface';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PaystackSignatureGuard)
  @ApiOperation({ summary: 'Idempotent Paystack webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or missing signature' })
  async handlePaystackWebhook(@Body() body: PaymentWebhookEvent) {
    this.logger.log(`Received Paystack webhook event=${body.event}`);
    const result = await this.paymentService.processPaymentWebhook(body);
    return result;
  }
}
