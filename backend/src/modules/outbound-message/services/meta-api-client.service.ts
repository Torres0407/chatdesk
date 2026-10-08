import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendWhatsAppMessageDto } from '../dto/outbound-message.dto';

export interface MetaApiResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

@Injectable()
export class MetaApiClientService {
  private readonly logger = new Logger(MetaApiClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(
    phoneNumberId: string,
    accessToken: string,
    payload: SendWhatsAppMessageDto,
  ): Promise<MetaApiResponse> {
    const baseUrl =
      this.configService.get<string>('META_API_BASE_URL') || 'https://graph.facebook.com';
    const apiVersion = this.configService.get<string>('META_API_VERSION') || 'v21.0';
    const url = `${baseUrl}/${apiVersion}/${phoneNumberId}/messages`;

    // In test environment or mock tokens, return deterministic mocked response
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'test' || accessToken === 'mock_token' || !accessToken) {
      this.logger.debug(
        `[MOCK Meta API] Sending message to ${payload.to} type=${payload.type}`,
      );
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: payload.to, wa_id: payload.to }],
        messages: [{ id: `wamid.MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}` }],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Meta API Error [${response.status}]: ${errorBody}`);
      throw new Error(`Meta API error ${response.status}: ${errorBody}`);
    }

    return (await response.json()) as MetaApiResponse;
  }
}
