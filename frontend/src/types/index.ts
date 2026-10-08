/**
 * ChatDesk - WhatsApp Business Bot Staff Dashboard
 * Core Domain Types & Strict Enums
 */

export type StaffRole = 'OWNER' | 'STAFF';

export type ConversationStatus = 'OPEN' | 'NEEDS_AGENT' | 'HUMAN_HANDLING' | 'RESOLVED';

export type OrderStatus = 'PENDING' | 'PAID' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export type MessageType = 'TEXT' | 'IMAGE' | 'BUTTON' | 'LIST' | 'TEMPLATE';

export type MessageDeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface Business {
  id: string;
  name: string;
  phone: string; // masked in UI: e.g. +234 *** *** 8899
  category: string;
  currency: string;
  currencySymbol: string;
  address: string;
  timezone: string;
  botEnabled: boolean;
  businessHours: {
    [day: string]: { open: string; close: string; closed: boolean };
  };
  slotRules: {
    slotDurationMinutes: number;
    bufferMinutes: number;
    maxConcurrentBookings: number;
  };
  welcomeMessage: string;
  fallbackMessage: string;
}

export interface StaffUser {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: StaffRole;
  avatarUrl?: string;
  lastActiveAt?: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string; // Masked e.g. +234 *** *** 4567
  email?: string;
  avatarUrl?: string;
  notes?: string;
  tags: string[];
  totalOrdersCount: number;
  totalBookingsCount: number;
  totalSpend: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface InteractiveOption {
  id: string;
  title: string;
  description?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  content: string; // Text content, caption, or description
  mediaUrl?: string; // For IMAGE type
  options?: InteractiveOption[]; // For BUTTON or LIST replies
  selectedOptionId?: string; // If customer replied to a button or list item
  deliveryStatus: MessageDeliveryStatus;
  sentByBot: boolean;
  senderStaffId?: string;
  createdAt: string; // ISO string
}

export interface Conversation {
  id: string;
  businessId: string;
  customerId: string;
  customer: Customer;
  status: ConversationStatus;
  assignedStaffId?: string;
  assignedStaff?: StaffUser;
  lastMessage?: Message;
  unreadCount: number;
  needsAgentReason?: string;
  lastCustomerMessageAt: string; // ISO string for 24-hr messaging window check
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  sku: string;
  imageUrl: string;
  category: string;
  inStock: boolean;
  stockQuantity: number;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  businessId: string;
  orderNumber: string; // e.g. ORD-1092
  customerId: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'WHATSAPP_PAY' | 'CARD' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY';
  deliveryAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  color: string;
  disabled: boolean;
}

export interface Booking {
  id: string;
  businessId: string;
  bookingNumber: string; // e.g. BKG-401
  customerId: string;
  customer: Customer;
  serviceId: string;
  service: Service;
  startTime: string; // ISO string
  endTime: string; // ISO string
  status: BookingStatus;
  notes?: string;
  cancellationReason?: string;
  assignedStaffId?: string;
  assignedStaff?: StaffUser;
  createdAt: string;
  updatedAt: string;
}

export interface Faq {
  id: string;
  businessId: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  usageCount: number;
  updatedAt: string;
}

export interface OptOut {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  phone: string; // Masked
  reason: string;
  optedOutAt: string; // ISO string
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

export interface ServerEvent {
  type: 'message.created' | 'conversation.updated' | 'order.updated' | 'booking.updated';
  timestamp: string;
  data: {
    conversationId?: string;
    message?: Message;
    conversation?: Conversation;
    order?: Order;
    booking?: Booking;
  };
}
