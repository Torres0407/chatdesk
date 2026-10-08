import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { MetaSignatureGuard, RequestWithRawBody } from './guards/meta-signature.guard';
import { MetaWebhookService } from './services/meta-webhook.service';
import {
  MetaWebhookPayload,
  MetaWebhookVerifyQueryDto,
} from './dto/meta-webhook.dto';

@ApiTags('Webhooks')
@Controller()
export class MetaWebhookController {
  constructor(private readonly webhookService: MetaWebhookService) {}

  @Get(['webhooks/meta', 'api/v1/webhooks/meta'])
  @ApiOperation({ summary: 'Verify Meta WhatsApp Cloud API Webhook Subscription' })
  @ApiResponse({ status: 200, description: 'Echoes back hub.challenge string' })
  @ApiResponse({ status: 403, description: 'Invalid verification token' })
  verifyWebhook(@Query() query: MetaWebhookVerifyQueryDto): string {
    return this.webhookService.verifyWebhook(query);
  }

  @Post(['webhooks/meta', 'api/v1/webhooks/meta'])
  @HttpCode(HttpStatus.OK)
  @UseGuards(MetaSignatureGuard)
  @ApiOperation({ summary: 'Receive Meta WhatsApp Inbound Events & Messages' })
  @ApiHeader({
    name: 'X-Hub-Signature-256',
    description: 'HMAC-SHA256 signature calculated with META_APP_SECRET over raw request body',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook received and queued for asynchronous processing' })
  @ApiResponse({ status: 401, description: 'Invalid or missing X-Hub-Signature-256' })
  async handleWebhook(
    @Body() payload: MetaWebhookPayload,
    @Req() _req: RequestWithRawBody,
  ): Promise<{ status: string; received: boolean }> {
    return this.webhookService.enqueuePayload(payload);
  }
}
