export type WhatsAppMessageType =
  | 'text'
  | 'interactive'
  | 'image'
  | 'template';

export interface WhatsAppTextPayload {
  preview_url?: boolean;
  body: string;
}

export interface WhatsAppButtonAction {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title: string;
  rows: WhatsAppListRow[];
}

export interface WhatsAppInteractiveButtonsPayload {
  type: 'button';
  header?: {
    type: 'text';
    text: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    buttons: WhatsAppButtonAction[];
  };
}

export interface WhatsAppInteractiveListPayload {
  type: 'list';
  header?: {
    type: 'text';
    text: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    button: string; // Button text that opens the list modal
    sections: WhatsAppListSection[];
  };
}

export type WhatsAppInteractivePayload =
  | WhatsAppInteractiveButtonsPayload
  | WhatsAppInteractiveListPayload;

export interface WhatsAppImagePayload {
  link: string;
  caption?: string;
}

export interface WhatsAppTemplatePayload {
  name: string;
  language: {
    code: string;
  };
  components?: any[];
}

export interface SendWhatsAppMessageDto {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: WhatsAppMessageType;
  text?: WhatsAppTextPayload;
  interactive?: WhatsAppInteractivePayload;
  image?: WhatsAppImagePayload;
  template?: WhatsAppTemplatePayload;
}

export interface EnqueueOutboundJobData {
  businessId: string;
  conversationId: string;
  customerId: string;
  toPhoneNumber: string;
  payload: SendWhatsAppMessageDto;
  bypass24HourWindow?: boolean;
  staffUserId?: string;
}
