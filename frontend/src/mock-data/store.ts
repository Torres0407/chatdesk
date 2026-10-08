import {
  Business,
  StaffUser,
  Customer,
  Conversation,
  Message,
  Product,
  Order,
  OrderStatus,
  Booking,
  Faq,
  OptOut,
  ServerEvent,
  PaginatedResult,
} from '../types';
import {
  INITIAL_BUSINESS,
  INITIAL_STAFF,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_SERVICES,
  INITIAL_BOOKINGS,
  INITIAL_FAQS,
  INITIAL_OPTOUTS,
  INITIAL_MESSAGES,
  INITIAL_CONVERSATIONS,
} from './data';

class MockStore {
  public business: Business = { ...INITIAL_BUSINESS };
  public staff: StaffUser[] = [...INITIAL_STAFF];
  public currentUser: StaffUser | null = INITIAL_STAFF[0]; // Logged in as Chioma (Owner) by default
  public customers: Customer[] = [...INITIAL_CUSTOMERS];
  public products: Product[] = [...INITIAL_PRODUCTS];
  public orders: Order[] = [...INITIAL_ORDERS];
  public services = [...INITIAL_SERVICES];
  public bookings: Booking[] = [...INITIAL_BOOKINGS];
  public faqs: Faq[] = [...INITIAL_FAQS];
  public optOuts: OptOut[] = [...INITIAL_OPTOUTS];
  public conversations: Conversation[] = [...INITIAL_CONVERSATIONS];
  public messages: Record<string, Message[]> = { ...INITIAL_MESSAGES };

  public simulateErrors: boolean = false;
  private eventSubscribers: Array<(event: ServerEvent) => void> = [];
  private simulationInterval: any = null;

  constructor() {
    this.startEventSimulator();
  }

  // --- Helper to delay execution ---
  public async delay(min = 200, max = 400): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  public checkSimulatedError(operationName: string): void {
    if (this.simulateErrors) {
      throw new Error(`Simulated Network/Server Error during ${operationName}. Please retry.`);
    }
  }

  // --- Event Subscription (simulates SSE) ---
  public subscribeEvents(handler: (event: ServerEvent) => void): () => void {
    this.eventSubscribers.push(handler);
    return () => {
      this.eventSubscribers = this.eventSubscribers.filter((h) => h !== handler);
    };
  }

  public emitEvent(event: ServerEvent): void {
    this.eventSubscribers.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error('Error in event listener', err);
      }
    });
  }

  private startEventSimulator(): void {
    if (typeof window === 'undefined') return;

    // Emit a simulated event every 40 seconds to give real-time feel
    this.simulationInterval = setInterval(() => {
      // Simulate random inbound customer ping if active
      if (Math.random() > 0.4) {
        const activeConvs = this.conversations.filter((c) => c.status !== 'RESOLVED');
        if (activeConvs.length > 0) {
          const targetConv = activeConvs[Math.floor(Math.random() * activeConvs.length)];
          const sampleMessages = [
            'Thanks for the quick update! Will the courier call upon arrival?',
            'Can you confirm if you have oat milk in stock today?',
            'What time is the tasting workshop tomorrow again?',
            'Checking in on the corporate gift box invoice, thank you!',
          ];
          const text = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
          const newMsg: Message = {
            id: `msg_sim_${Date.now()}`,
            conversationId: targetConv.id,
            direction: 'INBOUND',
            type: 'TEXT',
            content: text,
            deliveryStatus: 'READ',
            sentByBot: false,
            createdAt: new Date().toISOString(),
          };

          if (!this.messages[targetConv.id]) {
            this.messages[targetConv.id] = [];
          }
          this.messages[targetConv.id].push(newMsg);
          targetConv.lastMessage = newMsg;
          targetConv.unreadCount += 1;
          targetConv.lastCustomerMessageAt = newMsg.createdAt;
          targetConv.updatedAt = newMsg.createdAt;

          this.emitEvent({
            type: 'message.created',
            timestamp: new Date().toISOString(),
            data: { conversationId: targetConv.id, message: newMsg, conversation: { ...targetConv } },
          });
        }
      }
    }, 45000);
  }

  // --- Auth ---
  public async login(email: string, _password: string): Promise<StaffUser> {
    await this.delay();
    this.checkSimulatedError('Login');
    const user = this.staff.find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('Invalid email or password. Try chioma@brewbotanica.com or david@brewbotanica.com');
    }
    this.currentUser = user;
    return { ...user };
  }

  public async logout(): Promise<void> {
    await this.delay(100, 200);
    this.currentUser = null;
  }

  public async me(): Promise<StaffUser | null> {
    await this.delay(100, 250);
    return this.currentUser ? { ...this.currentUser } : null;
  }

  // --- Conversations ---
  public async listConversations(params?: {
    status?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }): Promise<PaginatedResult<Conversation>> {
    await this.delay();
    this.checkSimulatedError('List Conversations');

    let result = [...this.conversations];

    if (params?.status && params.status !== 'ALL') {
      result = result.filter((c) => c.status === params.status);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (c) =>
          c.customer.name.toLowerCase().includes(q) ||
          c.customer.phone.includes(q) ||
          (c.lastMessage && c.lastMessage.content.toLowerCase().includes(q)) ||
          (c.needsAgentReason && c.needsAgentReason.toLowerCase().includes(q))
      );
    }

    // Sort by latest message/update
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const limit = params?.limit || 15;
    const startIndex = params?.cursor ? parseInt(params.cursor, 10) : 0;
    const items = result.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < result.length ? (startIndex + limit).toString() : undefined;

    return {
      items: items.map((c) => ({
        ...c,
        customer: { ...c.customer },
        assignedStaff: c.assignedStaffId ? this.staff.find((s) => s.id === c.assignedStaffId) : undefined,
      })),
      nextCursor,
      total: result.length,
    };
  }

  public async getConversation(id: string): Promise<Conversation> {
    await this.delay();
    this.checkSimulatedError('Get Conversation');
    const conv = this.conversations.find((c) => c.id === id);
    if (!conv) throw new Error(`Conversation not found (${id})`);

    // Reset unread count when opened
    conv.unreadCount = 0;

    return {
      ...conv,
      customer: { ...conv.customer },
      assignedStaff: conv.assignedStaffId ? this.staff.find((s) => s.id === conv.assignedStaffId) : undefined,
    };
  }

  public async getMessages(conversationId: string, params?: { cursor?: string; limit?: number }): Promise<PaginatedResult<Message>> {
    await this.delay();
    this.checkSimulatedError('Get Messages');
    const list = this.messages[conversationId] || [];
    const limit = params?.limit || 50;
    const startIndex = params?.cursor ? parseInt(params.cursor, 10) : 0;
    const items = list.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < list.length ? (startIndex + limit).toString() : undefined;

    return {
      items: items.map((m) => ({ ...m })),
      nextCursor,
      total: list.length,
    };
  }

  public async takeOverConversation(id: string): Promise<Conversation> {
    await this.delay();
    this.checkSimulatedError('Take Over Conversation');
    const conv = this.conversations.find((c) => c.id === id);
    if (!conv) throw new Error(`Conversation not found (${id})`);

    conv.status = 'HUMAN_HANDLING';
    conv.assignedStaffId = this.currentUser?.id || 'staff_01';
    conv.assignedStaff = this.currentUser || this.staff[0];
    conv.updatedAt = new Date().toISOString();

    const updated = { ...conv };
    this.emitEvent({
      type: 'conversation.updated',
      timestamp: new Date().toISOString(),
      data: { conversationId: id, conversation: updated },
    });

    return updated;
  }

  public async handBackConversation(id: string): Promise<Conversation> {
    await this.delay();
    this.checkSimulatedError('Hand Back Conversation');
    const conv = this.conversations.find((c) => c.id === id);
    if (!conv) throw new Error(`Conversation not found (${id})`);

    conv.status = 'OPEN';
    conv.assignedStaffId = undefined;
    conv.assignedStaff = undefined;
    conv.updatedAt = new Date().toISOString();

    const updated = { ...conv };
    this.emitEvent({
      type: 'conversation.updated',
      timestamp: new Date().toISOString(),
      data: { conversationId: id, conversation: updated },
    });

    return updated;
  }

  public async resolveConversation(id: string): Promise<Conversation> {
    await this.delay();
    this.checkSimulatedError('Resolve Conversation');
    const conv = this.conversations.find((c) => c.id === id);
    if (!conv) throw new Error(`Conversation not found (${id})`);

    conv.status = 'RESOLVED';
    conv.updatedAt = new Date().toISOString();

    const updated = { ...conv };
    this.emitEvent({
      type: 'conversation.updated',
      timestamp: new Date().toISOString(),
      data: { conversationId: id, conversation: updated },
    });

    return updated;
  }

  public async sendReply(conversationId: string, text: string): Promise<Message> {
    await this.delay();
    this.checkSimulatedError('Send Reply');

    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error(`Conversation not found (${conversationId})`);

    // Strict Rule 1: Sending a reply is only allowed when status is HUMAN_HANDLING
    if (conv.status !== 'HUMAN_HANDLING') {
      const err = new Error(
        '409 Conflict: Bot or another process currently has control of this conversation. Take over the conversation to reply.'
      );
      (err as any).status = 409;
      throw err;
    }

    // Strict Rule 2: Outside 24-hour window
    // Check time diff between now and lastCustomerMessageAt
    const lastCustomerMsgTime = new Date(conv.lastCustomerMessageAt).getTime();
    const now = Date.now();
    const hoursSinceLastCustomerMsg = (now - lastCustomerMsgTime) / (1000 * 60 * 60);

    if (hoursSinceLastCustomerMsg > 24) {
      const err = new Error(
        '422 Unprocessable Entity: Outside 24-hour messaging window. Customer must message first before a human agent can reply.'
      );
      (err as any).status = 422;
      (err as any).code = 'OUTSIDE_24H_WINDOW';
      throw err;
    }

    const newMessage: Message = {
      id: `msg_rep_${Date.now()}`,
      conversationId,
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: text,
      deliveryStatus: 'SENT',
      sentByBot: false,
      senderStaffId: this.currentUser?.id || 'staff_01',
      createdAt: new Date().toISOString(),
    };

    if (!this.messages[conversationId]) {
      this.messages[conversationId] = [];
    }
    this.messages[conversationId].push(newMessage);

    conv.lastMessage = newMessage;
    conv.updatedAt = newMessage.createdAt;

    // Simulate WhatsApp delivery status transition: SENT -> DELIVERED -> READ
    setTimeout(() => {
      newMessage.deliveryStatus = 'DELIVERED';
      this.emitEvent({
        type: 'message.created',
        timestamp: new Date().toISOString(),
        data: { conversationId, message: { ...newMessage } },
      });
    }, 1200);

    setTimeout(() => {
      newMessage.deliveryStatus = 'READ';
      this.emitEvent({
        type: 'message.created',
        timestamp: new Date().toISOString(),
        data: { conversationId, message: { ...newMessage } },
      });
    }, 2800);

    this.emitEvent({
      type: 'message.created',
      timestamp: new Date().toISOString(),
      data: { conversationId, message: { ...newMessage }, conversation: { ...conv } },
    });

    return { ...newMessage };
  }

  // --- Orders ---
  public async listOrders(params?: { status?: string; cursor?: string; limit?: number; search?: string }): Promise<PaginatedResult<Order>> {
    await this.delay();
    this.checkSimulatedError('List Orders');

    let result = [...this.orders];
    if (params?.status && params.status !== 'ALL') {
      result = result.filter((o) => o.status === params.status);
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.phone.includes(q)
      );
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const limit = params?.limit || 20;
    const startIndex = params?.cursor ? parseInt(params.cursor, 10) : 0;
    const items = result.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < result.length ? (startIndex + limit).toString() : undefined;

    return {
      items: items.map((o) => ({ ...o, customer: { ...o.customer }, items: [...o.items] })),
      nextCursor,
      total: result.length,
    };
  }

  public async getOrder(id: string): Promise<Order> {
    await this.delay();
    this.checkSimulatedError('Get Order');
    const order = this.orders.find((o) => o.id === id);
    if (!order) throw new Error(`Order not found (${id})`);
    return { ...order, customer: { ...order.customer }, items: [...order.items] };
  }

  // Valid Order Transitions:
  // PENDING -> PAID, CANCELLED
  // PAID -> PREPARING, CANCELLED
  // PREPARING -> COMPLETED, CANCELLED
  // COMPLETED -> (Terminal)
  // CANCELLED -> (Terminal)
  public async updateOrderStatus(id: string, newStatus: OrderStatus): Promise<Order> {
    await this.delay();
    this.checkSimulatedError('Update Order Status');

    const order = this.orders.find((o) => o.id === id);
    if (!order) throw new Error(`Order not found (${id})`);

    const currentStatus = order.status;
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['PAID', 'CANCELLED'],
      PAID: ['PREPARING', 'CANCELLED'],
      PREPARING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (currentStatus === newStatus) {
      return { ...order };
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid order status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${validTransitions[currentStatus].join(', ') || 'None (terminal state)'}`);
    }

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    const updated = { ...order };
    this.emitEvent({
      type: 'order.updated',
      timestamp: new Date().toISOString(),
      data: { order: updated },
    });

    return updated;
  }

  // --- Bookings ---
  public async listBookings(params?: { from?: string; to?: string; status?: string }): Promise<Booking[]> {
    await this.delay();
    this.checkSimulatedError('List Bookings');

    let result = [...this.bookings];
    if (params?.status && params.status !== 'ALL') {
      result = result.filter((b) => b.status === params.status);
    }

    if (params?.from) {
      const fromTime = new Date(params.from).getTime();
      result = result.filter((b) => new Date(b.startTime).getTime() >= fromTime);
    }

    if (params?.to) {
      const toTime = new Date(params.to).getTime();
      result = result.filter((b) => new Date(b.startTime).getTime() <= toTime);
    }

    result.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return result.map((b) => ({
      ...b,
      customer: { ...b.customer },
      service: { ...b.service },
      assignedStaff: b.assignedStaffId ? this.staff.find((s) => s.id === b.assignedStaffId) : undefined,
    }));
  }

  public async getBooking(id: string): Promise<Booking> {
    await this.delay();
    this.checkSimulatedError('Get Booking');
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) throw new Error(`Booking not found (${id})`);
    return {
      ...booking,
      customer: { ...booking.customer },
      service: { ...booking.service },
      assignedStaff: booking.assignedStaffId ? this.staff.find((s) => s.id === booking.assignedStaffId) : undefined,
    };
  }

  public async cancelBooking(id: string, reason?: string): Promise<Booking> {
    await this.delay();
    this.checkSimulatedError('Cancel Booking');
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) throw new Error(`Booking not found (${id})`);

    booking.status = 'CANCELLED';
    booking.cancellationReason = reason || 'Cancelled by staff';
    booking.updatedAt = new Date().toISOString();

    const updated = { ...booking };
    this.emitEvent({
      type: 'booking.updated',
      timestamp: new Date().toISOString(),
      data: { booking: updated },
    });

    return updated;
  }

  public async rescheduleBooking(id: string, newStart: string): Promise<Booking> {
    await this.delay();
    this.checkSimulatedError('Reschedule Booking');
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) throw new Error(`Booking not found (${id})`);

    const startDate = new Date(newStart);
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid start date provided for rescheduling');
    }

    const duration = booking.service.durationMinutes || 45;
    const endDate = new Date(startDate.getTime() + duration * 60000);

    booking.startTime = startDate.toISOString();
    booking.endTime = endDate.toISOString();
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date().toISOString();

    const updated = { ...booking };
    this.emitEvent({
      type: 'booking.updated',
      timestamp: new Date().toISOString(),
      data: { booking: updated },
    });

    return updated;
  }

  // --- Products Catalog ---
  public async listProducts(): Promise<Product[]> {
    await this.delay();
    this.checkSimulatedError('List Products');
    return this.products.map((p) => ({ ...p }));
  }

  public async createProduct(data: Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    await this.delay();
    this.checkSimulatedError('Create Product');

    const newProd: Product = {
      ...data,
      id: `prod_${Date.now()}`,
      businessId: this.business.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.products.unshift(newProd);
    return { ...newProd };
  }

  public async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    await this.delay();
    this.checkSimulatedError('Update Product');

    const prod = this.products.find((p) => p.id === id);
    if (!prod) throw new Error(`Product not found (${id})`);

    Object.assign(prod, patch, { updatedAt: new Date().toISOString() });
    return { ...prod };
  }

  public async disableProduct(id: string, disabled: boolean): Promise<Product> {
    await this.delay();
    this.checkSimulatedError('Toggle Product Disabled State');

    const prod = this.products.find((p) => p.id === id);
    if (!prod) throw new Error(`Product not found (${id})`);

    prod.disabled = disabled;
    prod.updatedAt = new Date().toISOString();
    return { ...prod };
  }

  // --- FAQs ---
  public async listFaqs(): Promise<Faq[]> {
    await this.delay();
    this.checkSimulatedError('List FAQs');
    return this.faqs.map((f) => ({ ...f }));
  }

  public async createFaq(data: Omit<Faq, 'id' | 'businessId' | 'usageCount' | 'updatedAt'>): Promise<Faq> {
    await this.delay();
    this.checkSimulatedError('Create FAQ');

    const newFaq: Faq = {
      ...data,
      id: `faq_${Date.now()}`,
      businessId: this.business.id,
      usageCount: 0,
      updatedAt: new Date().toISOString(),
    };
    this.faqs.unshift(newFaq);
    return { ...newFaq };
  }

  public async updateFaq(id: string, patch: Partial<Faq>): Promise<Faq> {
    await this.delay();
    this.checkSimulatedError('Update FAQ');

    const faq = this.faqs.find((f) => f.id === id);
    if (!faq) throw new Error(`FAQ not found (${id})`);

    Object.assign(faq, patch, { updatedAt: new Date().toISOString() });
    return { ...faq };
  }

  public async deleteFaq(id: string): Promise<void> {
    await this.delay();
    this.checkSimulatedError('Delete FAQ');
    this.faqs = this.faqs.filter((f) => f.id !== id);
  }

  // --- Settings & Profile ---
  public async getSettings(): Promise<Business> {
    await this.delay();
    this.checkSimulatedError('Get Settings');
    return { ...this.business };
  }

  public async updateSettings(patch: Partial<Business>): Promise<Business> {
    await this.delay();
    this.checkSimulatedError('Update Settings');
    Object.assign(this.business, patch);
    return { ...this.business };
  }

  // --- Opt-Outs ---
  public async listOptOuts(): Promise<OptOut[]> {
    await this.delay();
    this.checkSimulatedError('List Opt-Outs');
    return this.optOuts.map((o) => ({ ...o }));
  }

  public async removeOptOut(id: string): Promise<void> {
    await this.delay();
    this.checkSimulatedError('Remove Opt-Out');
    this.optOuts = this.optOuts.filter((o) => o.id !== id);
  }
}

export const mockStore = new MockStore();
