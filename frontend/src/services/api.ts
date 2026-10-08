/**
 * ChatDesk Staff Dashboard - API Service Layer
 *
 * Supports both Real REST/SSE Backend and Mock In-Memory Store via VITE_API_MODE.
 * Maintains exact function signatures so no component changes are required.
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
import { http, setAccessToken, clearAccessToken, getApiBaseUrl, getAccessToken } from './http';

// Re-export error classes for components to consume
export * from './http';

/**
 * Determine API Mode from environment variable: 'real' | 'mock'
 */
export function getApiMode(): 'real' | 'mock' {
  const envMode = (import.meta as any).env?.VITE_API_MODE;
  if (envMode === 'mock') {
    return 'mock';
  }
  return 'real';
}

export const isRealApi = () => getApiMode() === 'real';

// Global error simulation toggle (for testing UI error banners)
export const apiConfig = {
  get simulateErrors(): boolean {
    return mockStore.simulateErrors;
  },
  setSimulateErrors(enabled: boolean) {
    mockStore.simulateErrors = enabled;
  },
};

// ==========================================
// DTO Mapping Utilities (Backend <-> Frontend)
// ==========================================

function mapStaffUser(u: any): StaffUser {
  if (!u) return u;
  return {
    id: u.id,
    businessId: u.businessId,
    name: u.name,
    email: u.email,
    role: u.role === 'OWNER' ? 'OWNER' : 'STAFF',
    avatarUrl: u.avatarUrl || undefined,
    lastActiveAt: u.lastActiveAt || u.updatedAt || undefined,
  };
}

function mapMessage(m: any): Message {
  if (!m) return m;

  let textContent = '';
  if (typeof m.content === 'string') {
    textContent = m.content;
  } else if (m.content && typeof m.content === 'object') {
    textContent =
      m.content.text?.body ||
      m.content.interactive?.button_reply?.title ||
      m.content.interactive?.list_reply?.title ||
      JSON.stringify(m.content);
  }

  let deliveryStatus: any = 'SENT';
  if (m.status === 'DELIVERED') deliveryStatus = 'DELIVERED';
  else if (m.status === 'READ') deliveryStatus = 'READ';
  else if (m.status === 'FAILED') deliveryStatus = 'FAILED';
  else if (m.status === 'SENDING' || m.status === 'PENDING') deliveryStatus = 'SENDING';

  return {
    id: m.id,
    conversationId: m.conversationId,
    direction: m.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
    type: m.type === 'INTERACTIVE_BUTTON' ? 'BUTTON' : m.type === 'IMAGE' ? 'IMAGE' : 'TEXT',
    content: textContent,
    mediaUrl: m.mediaUrl || undefined,
    deliveryStatus,
    sentByBot: !m.staffUserId,
    senderStaffId: m.staffUserId || undefined,
    createdAt: m.createdAt || new Date().toISOString(),
  };
}

function mapConversation(c: any): Conversation {
  if (!c) return c;

  let status: any = 'OPEN';
  if (c.status === 'HUMAN_HANDLING') status = 'HUMAN_HANDLING';
  else if (c.status === 'RESOLVED') status = 'RESOLVED';
  else if (c.status === 'NEEDS_AGENT') status = 'NEEDS_AGENT';
  else if (c.status === 'BOT') status = 'OPEN';

  const customerObj = c.customer || {};
  return {
    id: c.id,
    businessId: c.businessId,
    customerId: c.customerId,
    customer: {
      id: customerObj.id || c.customerId,
      businessId: c.businessId,
      name: customerObj.name || 'WhatsApp Customer',
      phone: customerObj.phoneNumber || '+234 *** *** 0000',
      email: customerObj.email || undefined,
      avatarUrl: customerObj.avatarUrl || undefined,
      notes: customerObj.notes || undefined,
      tags: customerObj.tags || [],
      totalOrdersCount: customerObj.totalOrdersCount || 0,
      totalBookingsCount: customerObj.totalBookingsCount || 0,
      totalSpend: Number(customerObj.totalSpend || 0),
      firstSeenAt: customerObj.createdAt || c.createdAt || new Date().toISOString(),
      lastSeenAt: c.lastCustomerMessageAt || c.updatedAt || new Date().toISOString(),
    },
    status,
    assignedStaffId: c.assignedStaffId || undefined,
    assignedStaff: c.assignedStaff ? mapStaffUser(c.assignedStaff) : undefined,
    lastMessage: c.messages && c.messages[0] ? mapMessage(c.messages[0]) : undefined,
    unreadCount: c.unreadCount || 0,
    needsAgentReason: c.needsAgentReason || undefined,
    lastCustomerMessageAt: c.lastCustomerMessageAt || c.updatedAt || new Date().toISOString(),
    createdAt: c.createdAt || new Date().toISOString(),
    updatedAt: c.updatedAt || new Date().toISOString(),
  };
}

function mapOrder(o: any): Order {
  if (!o) return o;
  return {
    id: o.id,
    businessId: o.businessId,
    orderNumber: o.id.slice(-6).toUpperCase(),
    customerId: o.customerId,
    customer: o.customer ? mapConversation({ customer: o.customer }).customer : ({} as any),
    items: (o.items || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      productName: item.name || 'Product',
      price: Number(item.unitPrice || 0),
      quantity: item.quantity || 1,
      imageUrl: item.imageUrl || undefined,
    })),
    subtotal: Number(o.totalAmount || 0),
    deliveryFee: 0,
    tax: 0,
    total: Number(o.totalAmount || 0),
    status: o.status as OrderStatus,
    paymentMethod: 'WHATSAPP_PAY',
    deliveryAddress: o.deliveryAddress || undefined,
    notes: o.notes || undefined,
    createdAt: o.createdAt || new Date().toISOString(),
    updatedAt: o.updatedAt || new Date().toISOString(),
  };
}

function mapBooking(b: any): Booking {
  if (!b) return b;
  return {
    id: b.id,
    businessId: b.businessId,
    bookingNumber: b.id.slice(-6).toUpperCase(),
    customerId: b.customerId,
    customer: b.customer ? mapConversation({ customer: b.customer }).customer : ({} as any),
    serviceId: b.serviceId || 'default_service',
    service: {
      id: b.serviceId || 'default_service',
      businessId: b.businessId,
      name: b.serviceName || 'Consultation Service',
      description: b.notes || '',
      durationMinutes: 60,
      price: 0,
      color: '#4F46E5',
      disabled: false,
    },
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    notes: b.notes || undefined,
    createdAt: b.createdAt || new Date().toISOString(),
    updatedAt: b.updatedAt || new Date().toISOString(),
  };
}

function mapProduct(p: any): Product {
  if (!p) return p;
  return {
    id: p.id,
    businessId: p.businessId,
    name: p.name,
    description: p.description || '',
    price: Number(p.price || 0),
    sku: p.sku || '',
    imageUrl: p.imageUrl || '',
    category: p.category || 'General',
    inStock: true,
    stockQuantity: 100,
    disabled: p.isActive === false,
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

function mapFaq(f: any): Faq {
  if (!f) return f;
  return {
    id: f.id,
    businessId: f.businessId,
    question: f.question,
    answer: f.answer,
    category: 'General',
    keywords: f.keywords || [],
    usageCount: f.usageCount || 0,
    updatedAt: f.updatedAt || new Date().toISOString(),
  };
}

function mapBusiness(s: any): Business {
  if (!s) return s;
  return {
    id: s.businessId || 'biz_01',
    name: s.business?.name || 'My WhatsApp Business',
    phone: s.business?.phoneNumberId || '+234 *** *** 0000',
    category: 'Retail',
    currency: 'NGN',
    currencySymbol: '₦',
    address: 'Lagos, Nigeria',
    timezone: 'Africa/Lagos',
    botEnabled: s.catalogEnabled ?? true,
    businessHours: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '10:00', close: '16:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    },
    slotRules: {
      slotDurationMinutes: 60,
      bufferMinutes: 15,
      maxConcurrentBookings: 1,
    },
    welcomeMessage: s.welcomeMessage || 'Welcome to our shop!',
    fallbackMessage: 'An agent will be with you shortly.',
  };
}

function mapOptOut(o: any): OptOut {
  if (!o) return o;
  return {
    id: o.id || `${o.businessId}_${o.phoneNumber}`,
    businessId: o.businessId,
    customerId: o.customerId || 'unknown',
    customerName: 'Customer',
    phone: o.phoneNumber || '+234 *** *** 0000',
    reason: o.reason || 'STOP',
    optedOutAt: o.createdAt || new Date().toISOString(),
  };
}

// ==========================================
// Main API Service Implementation
// ==========================================

export const api = {
  auth: {
    login: async (email: string, password = ''): Promise<StaffUser> => {
      if (getApiMode() === 'mock') {
        return mockStore.login(email, password);
      }

      const response = await http.post<{ accessToken: string; user: any }>('/auth/login', {
        email,
        password,
      });

      if (response?.accessToken) {
        setAccessToken(response.accessToken);
      }

      return mapStaffUser(response.user);
    },

    logout: async (): Promise<void> => {
      if (getApiMode() === 'mock') {
        return mockStore.logout();
      }

      try {
        await http.post('/auth/logout');
      } finally {
        clearAccessToken();
      }
    },

    me: async (): Promise<StaffUser | null> => {
      if (getApiMode() === 'mock') {
        return mockStore.me();
      }

      try {
        const user = await http.get('/auth/me');
        return mapStaffUser(user);
      } catch {
        return null;
      }
    },
  },

  conversations: {
    list: async (params?: {
      status?: string;
      search?: string;
      cursor?: string;
      limit?: number;
    }): Promise<PaginatedResult<Conversation>> => {
      if (getApiMode() === 'mock') {
        return mockStore.listConversations(params);
      }

      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set('limit', String(params.limit));
      if (params?.cursor) queryParams.set('cursor', params.cursor);
      if (params?.search) queryParams.set('search', params.search);

      if (params?.status && params.status !== 'ALL') {
        if (params.status === 'OPEN') {
          queryParams.set('status', 'BOT');
        } else {
          queryParams.set('status', params.status);
        }
      }

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const result = await http.get<PaginatedResult<any>>(`/conversations${queryStr}`);

      return {
        items: (result.items || []).map(mapConversation),
        nextCursor: result.nextCursor,
        total: result.total || result.items?.length || 0,
      };
    },

    get: async (id: string): Promise<Conversation> => {
      if (getApiMode() === 'mock') {
        return mockStore.getConversation(id);
      }

      const result = await http.get(`/conversations/${id}`);
      return mapConversation(result);
    },

    messages: async (
      id: string,
      params?: { cursor?: string; limit?: number }
    ): Promise<PaginatedResult<Message>> => {
      if (getApiMode() === 'mock') {
        return mockStore.getMessages(id, params);
      }

      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set('limit', String(params.limit));
      if (params?.cursor) queryParams.set('cursor', params.cursor);

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const result = await http.get<PaginatedResult<any>>(`/conversations/${id}/messages${queryStr}`);

      return {
        items: (result.items || []).map(mapMessage),
        nextCursor: result.nextCursor,
        total: result.total || result.items?.length || 0,
      };
    },

    takeOver: async (id: string): Promise<Conversation> => {
      if (getApiMode() === 'mock') {
        return mockStore.takeOverConversation(id);
      }

      const result = await http.post(`/conversations/${id}/take-over`);
      return mapConversation(result);
    },

    handBack: async (id: string): Promise<Conversation> => {
      if (getApiMode() === 'mock') {
        return mockStore.handBackConversation(id);
      }

      const result = await http.post(`/conversations/${id}/hand-back`);
      return mapConversation(result);
    },

    resolve: async (id: string): Promise<Conversation> => {
      if (getApiMode() === 'mock') {
        return mockStore.resolveConversation(id);
      }

      const result = await http.post(`/conversations/${id}/resolve`);
      return mapConversation(result);
    },

    sendReply: async (id: string, text: string): Promise<Message> => {
      if (getApiMode() === 'mock') {
        return mockStore.sendReply(id, text);
      }

      await http.post(`/conversations/${id}/messages`, { message: text });

      return {
        id: `msg_${Date.now()}`,
        conversationId: id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: text,
        deliveryStatus: 'SENT',
        sentByBot: false,
        createdAt: new Date().toISOString(),
      };
    },
  },

  orders: {
    list: async (params?: {
      status?: string;
      cursor?: string;
      limit?: number;
      search?: string;
    }): Promise<PaginatedResult<Order>> => {
      if (getApiMode() === 'mock') {
        return mockStore.listOrders(params);
      }

      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set('limit', String(params.limit));
      if (params?.cursor) queryParams.set('cursor', params.cursor);
      if (params?.status) queryParams.set('status', params.status);

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const result = await http.get<PaginatedResult<any>>(`/orders${queryStr}`);

      return {
        items: (result.items || []).map(mapOrder),
        nextCursor: result.nextCursor,
        total: result.total || result.items?.length || 0,
      };
    },

    get: async (id: string): Promise<Order> => {
      if (getApiMode() === 'mock') {
        return mockStore.getOrder(id);
      }

      const result = await http.get(`/orders/${id}`);
      return mapOrder(result);
    },

    updateStatus: async (id: string, status: OrderStatus): Promise<Order> => {
      if (getApiMode() === 'mock') {
        return mockStore.updateOrderStatus(id, status);
      }

      const result = await http.patch(`/orders/${id}/status`, { status });
      return mapOrder(result);
    },
  },

  bookings: {
    list: async (params?: {
      from?: string;
      to?: string;
      status?: string;
    }): Promise<Booking[]> => {
      if (getApiMode() === 'mock') {
        return mockStore.listBookings(params);
      }

      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.set('from', params.from);
      if (params?.to) queryParams.set('to', params.to);
      if (params?.status) queryParams.set('status', params.status);

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const result = await http.get<any[]>(`/bookings${queryStr}`);

      return (result || []).map(mapBooking);
    },

    get: async (id: string): Promise<Booking> => {
      if (getApiMode() === 'mock') {
        return mockStore.getBooking(id);
      }

      const result = await http.get(`/bookings/${id}`);
      return mapBooking(result);
    },

    cancel: async (id: string, reason?: string): Promise<Booking> => {
      if (getApiMode() === 'mock') {
        return mockStore.cancelBooking(id, reason);
      }

      const result = await http.post(`/bookings/${id}/cancel`, { reason });
      return mapBooking(result);
    },

    reschedule: async (id: string, newStart: string): Promise<Booking> => {
      if (getApiMode() === 'mock') {
        return mockStore.rescheduleBooking(id, newStart);
      }

      const startTime = new Date(newStart);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour slot default

      const result = await http.post(`/bookings/${id}/reschedule`, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      return mapBooking(result);
    },
  },

  products: {
    list: async (): Promise<Product[]> => {
      if (getApiMode() === 'mock') {
        return mockStore.listProducts();
      }

      const result = await http.get<any>('/products');
      const items = Array.isArray(result) ? result : result?.items || [];
      return items.map(mapProduct);
    },

    create: async (
      data: Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>
    ): Promise<Product> => {
      if (getApiMode() === 'mock') {
        return mockStore.createProduct(data);
      }

      const result = await http.post('/products', {
        name: data.name,
        description: data.description,
        price: data.price,
        sku: data.sku,
        imageUrl: data.imageUrl,
        category: data.category,
      });

      return mapProduct(result);
    },

    update: async (id: string, patch: Partial<Product>): Promise<Product> => {
      if (getApiMode() === 'mock') {
        return mockStore.updateProduct(id, patch);
      }

      const result = await http.patch(`/products/${id}`, patch);
      return mapProduct(result);
    },

    disable: async (id: string, disabled: boolean): Promise<Product> => {
      if (getApiMode() === 'mock') {
        return mockStore.disableProduct(id, disabled);
      }

      const result = await http.patch(`/products/${id}`, { isActive: !disabled });
      return mapProduct(result);
    },
  },

  faqs: {
    list: async (): Promise<Faq[]> => {
      if (getApiMode() === 'mock') {
        return mockStore.listFaqs();
      }

      const result = await http.get<any[]>('/faqs');
      return (result || []).map(mapFaq);
    },

    create: async (
      data: Omit<Faq, 'id' | 'businessId' | 'usageCount' | 'updatedAt'>
    ): Promise<Faq> => {
      if (getApiMode() === 'mock') {
        return mockStore.createFaq(data);
      }

      const result = await http.post('/faqs', data);
      return mapFaq(result);
    },

    update: async (id: string, patch: Partial<Faq>): Promise<Faq> => {
      if (getApiMode() === 'mock') {
        return mockStore.updateFaq(id, patch);
      }

      const result = await http.patch(`/faqs/${id}`, patch);
      return mapFaq(result);
    },

    delete: async (id: string): Promise<void> => {
      if (getApiMode() === 'mock') {
        return mockStore.deleteFaq(id);
      }

      await http.delete(`/faqs/${id}`);
    },
  },

  settings: {
    get: async (): Promise<Business> => {
      if (getApiMode() === 'mock') {
        return mockStore.getSettings();
      }

      const result = await http.get('/settings');
      return mapBusiness(result);
    },

    update: async (patch: Partial<Business>): Promise<Business> => {
      if (getApiMode() === 'mock') {
        return mockStore.updateSettings(patch);
      }

      const result = await http.patch('/settings', {
        welcomeMessage: patch.welcomeMessage,
        catalogEnabled: patch.botEnabled,
      });

      return mapBusiness(result);
    },
  },

  optOuts: {
    list: async (): Promise<OptOut[]> => {
      if (getApiMode() === 'mock') {
        return mockStore.listOptOuts();
      }

      const result = await http.get<any[]>('/opt-outs');
      return (result || []).map(mapOptOut);
    },

    remove: async (id: string): Promise<void> => {
      if (getApiMode() === 'mock') {
        return mockStore.removeOptOut(id);
      }

      await http.delete(`/opt-outs/${id}`);
    },
  },

  events: {
    subscribe: (handler: (event: ServerEvent) => void): (() => void) => {
      if (getApiMode() === 'mock') {
        return mockStore.subscribeEvents(handler);
      }

      // Real Server-Sent Events (SSE) Client with Auto-Reconnect & Backoff
      let isSubscribed = true;
      let reconnectTimeout: any = null;
      let backoffDelay = 1000;
      const MAX_BACKOFF = 30000;
      let abortController: AbortController | null = null;

      async function connectSse() {
        if (!isSubscribed) return;

        abortController = new AbortController();
        const baseUrl = getApiBaseUrl();
        const sseUrl = `${baseUrl}/events`;

        const token = getAccessToken();
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        try {
          const response = await fetch(sseUrl, {
            headers,
            credentials: 'include',
            signal: abortController.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error(`SSE stream connection failed with HTTP status ${response.status}`);
          }

          // Reset backoff on successful connection
          backoffDelay = 1000;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (isSubscribed) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent: string | null = null;
            let currentData: string | null = null;

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) {
                if (currentData) {
                  try {
                    const parsed = JSON.parse(currentData);

                    // Skip internal keep-alive pings and connected handshake
                    if (parsed.type !== 'ping' && parsed.type !== 'connected') {
                      let mappedEvent: ServerEvent | null = null;

                      if (parsed.type === 'message.created') {
                        mappedEvent = {
                          type: 'message.created',
                          timestamp: parsed.timestamp || new Date().toISOString(),
                          data: {
                            conversationId: parsed.data?.conversationId,
                            message: mapMessage(parsed.data?.message),
                          },
                        };
                      } else if (parsed.type === 'conversation.updated' || parsed.type === 'handoff.triggered') {
                        mappedEvent = {
                          type: 'conversation.updated',
                          timestamp: parsed.timestamp || new Date().toISOString(),
                          data: {
                            conversationId: parsed.data?.conversationId,
                            conversation: mapConversation(parsed.data),
                          },
                        };
                      } else if (parsed.type === 'order.updated') {
                        mappedEvent = {
                          type: 'order.updated',
                          timestamp: parsed.timestamp || new Date().toISOString(),
                          data: {
                            order: mapOrder(parsed.data),
                          },
                        };
                      } else if (parsed.type === 'booking.updated') {
                        mappedEvent = {
                          type: 'booking.updated',
                          timestamp: parsed.timestamp || new Date().toISOString(),
                          data: {
                            booking: mapBooking(parsed.data),
                          },
                        };
                      }

                      if (mappedEvent) {
                        handler(mappedEvent);
                      }
                    }
                  } catch {
                    // Ignore malformed JSON event payload
                  }
                  currentData = null;
                  currentEvent = null;
                }
                continue;
              }

              if (trimmed.startsWith('event:')) {
                currentEvent = trimmed.replace(/^event:\s*/, '');
              } else if (trimmed.startsWith('data:')) {
                const chunk = trimmed.replace(/^data:\s*/, '');
                currentData = currentData ? `${currentData}\n${chunk}` : chunk;
              }
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }

        // Auto-reconnect with exponential backoff
        if (isSubscribed) {
          reconnectTimeout = setTimeout(() => {
            backoffDelay = Math.min(backoffDelay * 1.5, MAX_BACKOFF);
            connectSse();
          }, backoffDelay);
        }
      }

      connectSse();

      return () => {
        isSubscribed = false;
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (abortController) abortController.abort();
      };
    },
  },
};
