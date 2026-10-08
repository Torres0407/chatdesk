/**
 * ChatDesk Staff Dashboard - API Service Layer
 *
 * NOTE: This is the sole integration boundary for all data requests.
 * Components NEVER import mock data directly.
 * To swap mock data with a real REST backend, replace this file's implementations
 * with `fetch()` calls to `/api/v1/*` as documented in `docs/API_CONTRACT.md`.
 */

import {
  StaffUser,
  Conversation,
  Message,
  Order,
  OrderStatus,
  Booking,
  Product,
  Faq,
  Business,
  OptOut,
  PaginatedResult,
  ServerEvent,
} from '../types';
import { mockStore } from '../mock-data/store';

// Global error simulation toggle (exported for testing error states and retry banners)
export const apiConfig = {
  get simulateErrors(): boolean {
    return mockStore.simulateErrors;
  },
  setSimulateErrors(enabled: boolean) {
    mockStore.simulateErrors = enabled;
  },
};

export const api = {
  auth: {
    login: async (email: string, password: string): Promise<StaffUser> => {
      return mockStore.login(email, password);
    },
    logout: async (): Promise<void> => {
      return mockStore.logout();
    },
    me: async (): Promise<StaffUser | null> => {
      return mockStore.me();
    },
  },

  conversations: {
    list: async (params?: {
      status?: string;
      search?: string;
      cursor?: string;
      limit?: number;
    }): Promise<PaginatedResult<Conversation>> => {
      return mockStore.listConversations(params);
    },
    get: async (id: string): Promise<Conversation> => {
      return mockStore.getConversation(id);
    },
    messages: async (
      id: string,
      params?: { cursor?: string; limit?: number }
    ): Promise<PaginatedResult<Message>> => {
      return mockStore.getMessages(id, params);
    },
    takeOver: async (id: string): Promise<Conversation> => {
      return mockStore.takeOverConversation(id);
    },
    handBack: async (id: string): Promise<Conversation> => {
      return mockStore.handBackConversation(id);
    },
    resolve: async (id: string): Promise<Conversation> => {
      return mockStore.resolveConversation(id);
    },
    sendReply: async (id: string, text: string): Promise<Message> => {
      return mockStore.sendReply(id, text);
    },
  },

  orders: {
    list: async (params?: {
      status?: string;
      cursor?: string;
      limit?: number;
      search?: string;
    }): Promise<PaginatedResult<Order>> => {
      return mockStore.listOrders(params);
    },
    get: async (id: string): Promise<Order> => {
      return mockStore.getOrder(id);
    },
    updateStatus: async (id: string, status: OrderStatus): Promise<Order> => {
      return mockStore.updateOrderStatus(id, status);
    },
  },

  bookings: {
    list: async (params?: {
      from?: string;
      to?: string;
      status?: string;
    }): Promise<Booking[]> => {
      return mockStore.listBookings(params);
    },
    get: async (id: string): Promise<Booking> => {
      return mockStore.getBooking(id);
    },
    cancel: async (id: string, reason?: string): Promise<Booking> => {
      return mockStore.cancelBooking(id, reason);
    },
    reschedule: async (id: string, newStart: string): Promise<Booking> => {
      return mockStore.rescheduleBooking(id, newStart);
    },
  },

  products: {
    list: async (): Promise<Product[]> => {
      return mockStore.listProducts();
    },
    create: async (
      data: Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>
    ): Promise<Product> => {
      return mockStore.createProduct(data);
    },
    update: async (id: string, patch: Partial<Product>): Promise<Product> => {
      return mockStore.updateProduct(id, patch);
    },
    disable: async (id: string, disabled: boolean): Promise<Product> => {
      return mockStore.disableProduct(id, disabled);
    },
  },

  faqs: {
    list: async (): Promise<Faq[]> => {
      return mockStore.listFaqs();
    },
    create: async (
      data: Omit<Faq, 'id' | 'businessId' | 'usageCount' | 'updatedAt'>
    ): Promise<Faq> => {
      return mockStore.createFaq(data);
    },
    update: async (id: string, patch: Partial<Faq>): Promise<Faq> => {
      return mockStore.updateFaq(id, patch);
    },
    delete: async (id: string): Promise<void> => {
      return mockStore.deleteFaq(id);
    },
  },

  settings: {
    get: async (): Promise<Business> => {
      return mockStore.getSettings();
    },
    update: async (patch: Partial<Business>): Promise<Business> => {
      return mockStore.updateSettings(patch);
    },
  },

  optOuts: {
    list: async (): Promise<OptOut[]> => {
      return mockStore.listOptOuts();
    },
    remove: async (id: string): Promise<void> => {
      return mockStore.removeOptOut(id);
    },
  },

  events: {
    subscribe: (handler: (event: ServerEvent) => void): (() => void) => {
      return mockStore.subscribeEvents(handler);
    },
  },
};
