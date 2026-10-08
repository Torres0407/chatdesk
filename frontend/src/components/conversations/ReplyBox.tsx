import React, { useState } from 'react';
import { Send, UserCheck, Bot, Sparkles, AlertCircle, Clock } from 'lucide-react';
import { ConversationStatus } from '../../types';

interface ReplyBoxProps {
  status: ConversationStatus;
  lastCustomerMessageAt: string;
  onSendReply: (text: string) => Promise<void>;
  onTakeOver: () => Promise<void>;
  onHandBack: () => Promise<void>;
  isActionLoading?: boolean;
}

export const ReplyBox: React.FC<ReplyBoxProps> = ({
  status,
  lastCustomerMessageAt,
  onSendReply,
  onTakeOver,
  onHandBack,
  isActionLoading = false,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Check 24-hr WhatsApp window
  const isOutside24Hours = () => {
    try {
      const lastMsg = new Date(lastCustomerMessageAt).getTime();
      const now = Date.now();
      const diffHours = (now - lastMsg) / (1000 * 60 * 60);
      return diffHours > 24;
    } catch {
      return false;
    }
  };

  const outsideWindow = isOutside24Hours();
  const isHumanHandling = status === 'HUMAN_HANDLING';

  const quickTemplates = [
    'Hello! This is staff assisting you. How may I help you right away?',
    'I have confirmed your delivery address update with our fulfillment dispatch.',
    'Your workshop booking has been updated. Looking forward to welcoming you!',
    'Here is our latest seasonal catalog menu. Let me know if you would like me to prepare an order!',
  ];

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || sending) return;

    if (!isHumanHandling) {
      setErrorBanner('Conversation is controlled by WhatsApp Bot. Take over first to reply.');
      return;
    }

    if (outsideWindow) {
      setErrorBanner(
        'WhatsApp Policy Violation: Outside 24-hour window. The customer must send an inbound message first before free-form session messages can be sent.'
      );
      return;
    }

    setSending(true);
    setErrorBanner(null);

    try {
      const msgText = text.trim();
      setText('');
      await onSendReply(msgText);
    } catch (err: any) {
      // 409 or 422 handling
      if (err?.status === 409 || err?.message?.includes('409')) {
        setErrorBanner('409 Conflict: Bot or another staff agent has control of this thread. Please refresh or take over.');
      } else if (err?.code === 'OUTSIDE_24H_WINDOW' || err?.message?.includes('Outside 24-hour')) {
        setErrorBanner('Outside 24-hour window. Customer must message first before a human reply can be dispatched.');
      } else {
        setErrorBanner(err?.message || 'Failed to send message. Please retry.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
      {/* 24-Hour Policy Warning Banner if outside */}
      {outsideWindow && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-200 text-xs"
        >
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-semibold">WhatsApp 24-Hour Window Closed: </span>
            More than 24 hours have elapsed since the customer&apos;s last inbound message. Due to WhatsApp Business API rules, customer must message first before free-form replies can be delivered.
          </div>
        </div>
      )}

      {/* Error state banner */}
      {errorBanner && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-200 text-xs"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">{errorBanner}</div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Bot Handover Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          {isHumanHandling ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Human Staff Controlling Thread
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Bot className="w-3.5 h-3.5 text-sky-500" />
              Automated Bot is active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isHumanHandling ? (
            <button
              onClick={onTakeOver}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Take over</span>
            </button>
          ) : (
            <button
              onClick={onHandBack}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <Bot className="w-3.5 h-3.5 text-sky-600" />
              <span>Hand back to bot</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Template Chips (only if human handling) */}
      {isHumanHandling && !outsideWindow && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none text-[11px]">
          <span className="text-slate-400 shrink-0 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Canned:
          </span>
          {quickTemplates.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setText(tmpl)}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap transition shrink-0 border border-slate-200/60 dark:border-slate-700"
            >
              {tmpl.substring(0, 32)}...
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSend} className="relative flex items-end gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isHumanHandling || outsideWindow || sending}
          placeholder={
            !isHumanHandling
              ? 'Bot currently managing conversation. Click "Take over" above to reply as human staff...'
              : outsideWindow
              ? 'Reply disabled: outside 24h WhatsApp window (waiting for customer message)...'
              : 'Type a WhatsApp message to customer (Enter to send, Shift+Enter for newline)...'
          }
          className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 p-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed transition"
        />

        <button
          type="submit"
          disabled={!isHumanHandling || outsideWindow || !text.trim() || sending}
          className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
          aria-label="Send WhatsApp message"
        >
          <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} />
          <span className="hidden sm:inline text-xs font-semibold">{sending ? 'Sending...' : 'Send'}</span>
        </button>
      </form>
    </div>
  );
};
