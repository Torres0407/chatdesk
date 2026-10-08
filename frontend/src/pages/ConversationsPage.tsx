import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message, ConversationStatus } from '../types';
import { api } from '../services/api';
import { ConversationItem } from '../components/conversations/ConversationItem';
import { MessageBubble } from '../components/conversations/MessageBubble';
import { ReplyBox } from '../components/conversations/ReplyBox';
import { CustomerDetailPanel } from '../components/conversations/CustomerDetailPanel';
import { ConversationSkeleton } from '../components/common/Skeleton';
import { RetryBanner } from '../components/common/RetryBanner';
import { EmptyState } from '../components/common/EmptyState';
import { Drawer } from '../components/common/Drawer';
import { useToast } from '../context/ToastContext';
import { useLiveEvents } from '../context/LiveEventContext';
import {
  Search,
  ArrowLeft,
  UserCheck,
  Bot,
  CheckCheck,
  PanelRightOpen,
  PanelRightClose,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import { BookingDetailDrawer } from '../components/bookings/BookingDetailDrawer';

export const ConversationsPage: React.FC = () => {
  const { addToast } = useToast();
  const { lastEvent } = useLiveEvents();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | ConversationStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Conversation & Messages
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // UI Panels
  const [showCustomerPanel, setShowCustomerPanel] = useState(false);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [viewBookingId, setViewBookingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.conversations.list({
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: searchQuery,
      });
      setConversations(res.items);

      // Auto-select first conversation on desktop if none selected
      if (!selectedId && res.items.length > 0 && window.innerWidth >= 1024) {
        setSelectedId(res.items[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch conversations.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, selectedId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    let active = true;
    setLoadingMessages(true);

    Promise.all([
      api.conversations.get(selectedId),
      api.conversations.messages(selectedId),
    ])
      .then(([conv, msgs]) => {
        if (!active) return;
        setActiveConversation(conv);
        setMessages(msgs.items);
        // Also update local list unreadCount to 0
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c))
        );
      })
      .catch((err) => {
        if (!active) return;
        addToast(err?.message || 'Failed to load conversation thread', 'error');
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId, addToast]);

  // Handle live events
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'message.created') {
      const { conversationId, message } = lastEvent.data;
      if (conversationId && message) {
        // If message is in active conversation, append it
        if (conversationId === selectedId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) {
              return prev.map((m) => (m.id === message.id ? message : m));
            }
            return [...prev, message];
          });
        }
        // Update last message in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessage: message,
                  unreadCount: conversationId === selectedId ? 0 : c.unreadCount + 1,
                  updatedAt: message.createdAt,
                }
              : c
          )
        );
      }
    } else if (lastEvent.type === 'conversation.updated') {
      const { conversationId, conversation } = lastEvent.data;
      if (conversationId && conversation) {
        if (conversationId === selectedId) {
          setActiveConversation(conversation);
        }
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? conversation : c))
        );
      }
    }
  }, [lastEvent, selectedId]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Optimistic Action Handlers with Rollback ---
  const handleTakeOver = async () => {
    if (!activeConversation) return;
    const prevConv = { ...activeConversation };
    const prevList = [...conversations];

    // Optimistic state
    const optimistic: Conversation = {
      ...activeConversation,
      status: 'HUMAN_HANDLING',
      updatedAt: new Date().toISOString(),
    };
    setActiveConversation(optimistic);
    setConversations((prev) =>
      prev.map((c) => (c.id === optimistic.id ? optimistic : c))
    );
    setActionLoading(true);

    try {
      const updated = await api.conversations.takeOver(activeConversation.id);
      setActiveConversation(updated);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      addToast('Took over conversation. You are now chatting with customer.', 'success');
    } catch (err: any) {
      // Rollback
      setActiveConversation(prevConv);
      setConversations(prevList);
      addToast(err?.message || 'Failed to take over conversation. Rolled back.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandBack = async () => {
    if (!activeConversation) return;
    const prevConv = { ...activeConversation };
    const prevList = [...conversations];

    // Optimistic state
    const optimistic: Conversation = {
      ...activeConversation,
      status: 'OPEN',
      assignedStaffId: undefined,
      assignedStaff: undefined,
      updatedAt: new Date().toISOString(),
    };
    setActiveConversation(optimistic);
    setConversations((prev) =>
      prev.map((c) => (c.id === optimistic.id ? optimistic : c))
    );
    setActionLoading(true);

    try {
      const updated = await api.conversations.handBack(activeConversation.id);
      setActiveConversation(updated);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      addToast('Handed back conversation to WhatsApp Bot.', 'info');
    } catch (err: any) {
      // Rollback
      setActiveConversation(prevConv);
      setConversations(prevList);
      addToast(err?.message || 'Failed to hand back to bot. Rolled back.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!activeConversation) return;
    const prevConv = { ...activeConversation };
    const prevList = [...conversations];

    const optimistic: Conversation = {
      ...activeConversation,
      status: 'RESOLVED',
      updatedAt: new Date().toISOString(),
    };
    setActiveConversation(optimistic);
    setConversations((prev) =>
      prev.map((c) => (c.id === optimistic.id ? optimistic : c))
    );
    setActionLoading(true);

    try {
      const updated = await api.conversations.resolve(activeConversation.id);
      setActiveConversation(updated);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      addToast('Conversation marked as Resolved.', 'success');
    } catch (err: any) {
      setActiveConversation(prevConv);
      setConversations(prevList);
      addToast(err?.message || 'Failed to resolve conversation. Rolled back.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReply = async (text: string) => {
    if (!activeConversation) return;

    // Optimistic message append
    const tempMsgId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempMsgId,
      conversationId: activeConversation.id,
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: text,
      deliveryStatus: 'SENDING',
      sentByBot: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const createdMsg = await api.conversations.sendReply(activeConversation.id, text);
      // Replace optimistic message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempMsgId ? createdMsg : m))
      );
    } catch (err: any) {
      // Rollback: remove optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempMsgId));
      throw err; // Re-throw so ReplyBox displays the 409 or 24-hr error banner
    }
  };

  return (
    <div className="h-full flex flex-row overflow-hidden bg-white dark:bg-slate-900">
      {/* LEFT COLUMN: Conversation Inbox List (Hidden on mobile if conversation is selected) */}
      <div
        className={`w-full lg:w-80 xl:w-96 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 h-full ${
          selectedId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Search & Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, phone, or msg..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'NEEDS_AGENT', label: 'Needs Agent' },
                { id: 'OPEN', label: 'Open' },
                { id: 'RESOLVED', label: 'Resolved' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-1.5 rounded-lg font-medium transition text-center ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {error && <RetryBanner message={error} onRetry={loadConversations} retrying={loading} />}

          {loading ? (
            <ConversationSkeleton count={6} />
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No conversations found"
              description="No active WhatsApp threads match your current filter or search criteria."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {conversations.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  isSelected={selectedId === c.id}
                  onSelect={() => setSelectedId(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MIDDLE COLUMN: Message Thread & Active Chat */}
      <div
        className={`flex-1 flex flex-col h-full min-w-0 bg-slate-50 dark:bg-slate-950 ${
          !selectedId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back to list button on mobile */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Back to conversations inbox"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative shrink-0">
                  {activeConversation.customer.avatarUrl ? (
                    <img
                      src={activeConversation.customer.avatarUrl}
                      alt={activeConversation.customer.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-xs">
                      {activeConversation.customer.name.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {activeConversation.customer.name}
                    </h2>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {activeConversation.customer.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Status: {activeConversation.status.replace('_', ' ')}</span>
                    {activeConversation.assignedStaff && (
                      <>
                        <span>·</span>
                        <span>Assigned: {activeConversation.assignedStaff.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Thread Action Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {activeConversation.status !== 'RESOLVED' && (
                  <button
                    onClick={handleResolve}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Resolve</span>
                  </button>
                )}

                {/* Customer Details Toggle */}
                <button
                  onClick={() => setShowCustomerPanel(!showCustomerPanel)}
                  className={`p-2 rounded-lg border transition ${
                    showCustomerPanel
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  aria-label="Toggle customer details panel"
                  title="Toggle customer details info"
                >
                  {showCustomerPanel ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Message Thread Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mb-2" />
                  <p className="text-xs text-slate-400">Loading WhatsApp message thread...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  No messages recorded in this conversation thread yet.
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    staffName={activeConversation.assignedStaff?.name}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Reply Box (Enabled only when human has taken over) */}
            <ReplyBox
              status={activeConversation.status}
              lastCustomerMessageAt={activeConversation.lastCustomerMessageAt}
              onSendReply={handleSendReply}
              onTakeOver={handleTakeOver}
              onHandBack={handleHandBack}
              isActionLoading={actionLoading}
            />
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-6">
            <EmptyState
              icon={MessageSquare}
              title="Select a WhatsApp conversation"
              description="Choose a conversation from the left inbox to view the WhatsApp chat thread, takeover bot automation, or inspect orders."
            />
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Customer Details Side Panel (Desktop inline, mobile drawer) */}
      {showCustomerPanel && activeConversation && (
        <div className="hidden xl:block w-80 shrink-0 h-full">
          <CustomerDetailPanel
            customer={activeConversation.customer}
            onClose={() => setShowCustomerPanel(false)}
            onSelectOrder={(id) => setViewOrderId(id)}
            onSelectBooking={(id) => setViewBookingId(id)}
          />
        </div>
      )}

      {/* Mobile/Tablet Drawer for Customer Details */}
      <Drawer
        isOpen={showCustomerPanel && !!activeConversation && window.innerWidth < 1280}
        onClose={() => setShowCustomerPanel(false)}
        title="Customer Profile"
        subtitle={activeConversation?.customer.name}
      >
        {activeConversation && (
          <CustomerDetailPanel
            customer={activeConversation.customer}
            onClose={() => setShowCustomerPanel(false)}
            onSelectOrder={(id) => {
              setShowCustomerPanel(false);
              setViewOrderId(id);
            }}
            onSelectBooking={(id) => {
              setShowCustomerPanel(false);
              setViewBookingId(id);
            }}
          />
        )}
      </Drawer>

      {/* Order Detail Drawer popup (if opened from customer side panel) */}
      {viewOrderId && (
        <OrderDetailDrawer
          orderId={viewOrderId}
          isOpen={!!viewOrderId}
          onClose={() => setViewOrderId(null)}
        />
      )}

      {/* Booking Detail Drawer popup (if opened from customer side panel) */}
      {viewBookingId && (
        <BookingDetailDrawer
          bookingId={viewBookingId}
          isOpen={!!viewBookingId}
          onClose={() => setViewBookingId(null)}
        />
      )}
    </div>
  );
};
