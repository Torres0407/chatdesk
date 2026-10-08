export type DomainEventType =
  | 'message.created'
  | 'message.status'
  | 'conversation.updated'
  | 'conversation.claimed'
  | 'conversation.resolved'
  | 'handoff.triggered'
  | 'order.created'
  | 'order.updated'
  | 'booking.created'
  | 'booking.updated'
  | 'payment.received'
  | 'ping';

export interface AppDomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  businessId: string;
  timestamp: string;
  data: T;
}

export interface HandoffTriggeredData {
  conversationId: string;
  customerId: string;
  customerPhone: string;
  customerName?: string | null;
  reason: 'KEYWORD' | 'BUTTON_CLICK' | 'CONSECUTIVE_FALLBACKS' | 'URGENT_KEYWORD';
  priority: 'NORMAL' | 'URGENT';
  messageSnippet?: string;
  isOutsideOperatingHours?: boolean;
}
