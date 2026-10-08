export enum ConversationState {
  MAIN_MENU = 'MAIN_MENU',
  BROWSING_CATALOG = 'BROWSING_CATALOG',
  CART = 'CART',
  CHECKOUT = 'CHECKOUT',
  BOOKING_DATE = 'BOOKING_DATE',
  BOOKING_TIME = 'BOOKING_TIME',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  HUMAN_HANDLING = 'HUMAN_HANDLING',
}

export interface ConversationSessionContext {
  state: ConversationState;
  metadata?: Record<string, any>;
  updatedAt: number;
}
