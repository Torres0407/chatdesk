import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MetaWebhookVerifyQueryDto {
  @ApiProperty({ description: 'Meta verification mode (typically "subscribe")', example: 'subscribe' })
  @IsString()
  'hub.mode'!: string;

  @ApiProperty({ description: 'Meta verification challenge string to echo back', example: '1158201444' })
  @IsString()
  'hub.challenge'!: string;

  @ApiProperty({ description: 'Verification token configured in Meta App dashboard', example: 'chatdesk_wa_verify_token_secure' })
  @IsString()
  'hub.verify_token'!: string;
}

export interface MetaContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface MetaTextMessage {
  body: string;
}

export interface MetaInteractiveButtonReply {
  id: string;
  title: string;
}

export interface MetaInteractiveListReply {
  id: string;
  title: string;
  description?: string;
}

export interface MetaInteractiveMessage {
  type: 'button_reply' | 'list_reply';
  button_reply?: MetaInteractiveButtonReply;
  list_reply?: MetaInteractiveListReply;
}

export interface MetaImageMessage {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface MetaInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'image' | 'button' | 'order' | 'system' | 'unknown';
  text?: MetaTextMessage;
  interactive?: MetaInteractiveMessage;
  image?: MetaImageMessage;
  button?: {
    payload: string;
    text: string;
  };
}

export interface MetaStatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data?: { details: string };
  }>;
}

export interface MetaWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaContact[];
  messages?: MetaInboundMessage[];
  statuses?: MetaStatusUpdate[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: string;
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}
