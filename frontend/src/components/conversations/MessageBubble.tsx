import React from 'react';
import { Check, CheckCheck, AlertCircle, Bot, User } from 'lucide-react';
import { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  staffName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, staffName }) => {
  const isInbound = message.direction === 'INBOUND';

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderDeliveryTicks = () => {
    if (isInbound) return null;
    switch (message.deliveryStatus) {
      case 'READ':
        return <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
      case 'DELIVERED':
        return <CheckCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />;
      case 'SENT':
        return <Check className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />;
      case 'FAILED':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      default:
        return <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className={`flex w-full ${isInbound ? 'justify-start' : 'justify-end'} mb-2.5`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-2xs text-xs sm:text-sm leading-relaxed ${
          isInbound
            ? 'bg-white text-slate-900 border border-slate-200/80 rounded-tl-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
            : 'bg-[#DCF8C6] text-slate-900 border border-emerald-200/60 rounded-tr-xs dark:bg-[#056162] dark:text-emerald-50 dark:border-emerald-800'
        }`}
      >
        {/* Sender Header for Outbound (Bot vs Staff) */}
        {!isInbound && (
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
            {message.sentByBot ? (
              <>
                <Bot className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>ChatDesk Bot</span>
              </>
            ) : (
              <>
                <User className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                <span>{staffName || 'Staff Agent'}</span>
              </>
            )}
          </div>
        )}

        {/* Media (Image) */}
        {message.type === 'IMAGE' && message.mediaUrl && (
          <div className="mb-2 rounded-xl overflow-hidden border border-black/5">
            <img
              src={message.mediaUrl}
              alt="Shared WhatsApp media"
              className="max-h-60 w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Message Content */}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* Interactive Options / Buttons Chips */}
        {message.options && message.options.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/10 space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Interactive Choices:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.options.map((opt) => {
                const isSelected = message.selectedOptionId === opt.id;
                return (
                  <span
                    key={opt.id}
                    className={`inline-flex items-center text-xs px-2.5 py-1 rounded-lg border font-medium ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                        : 'bg-white/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {opt.title}
                    {isSelected && ' ✓'}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Timestamp and delivery status */}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-300 select-none">
          <span>{formatTime(message.createdAt)}</span>
          {renderDeliveryTicks()}
        </div>
      </div>
    </div>
  );
};
