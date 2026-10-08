import React from 'react';
import { Conversation } from '../../types';
import { ConversationStatusBadge } from '../common/StatusBadge';
import { AlertCircle, Clock } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onSelect,
}) => {
  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const isNeedsAgent = conversation.status === 'NEEDS_AGENT';

  return (
    <div
      onClick={onSelect}
      className={`group relative p-3.5 border-b border-slate-100 dark:border-slate-800/80 cursor-pointer transition select-none ${
        isSelected
          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-l-4 border-l-emerald-600'
          : isNeedsAgent
          ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-l-4 border-l-amber-500'
          : 'hover:bg-slate-50 dark:hover:bg-slate-850/60'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          {conversation.customer.avatarUrl ? (
            <img
              src={conversation.customer.avatarUrl}
              alt={conversation.customer.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-sm">
              {conversation.customer.name.charAt(0)}
            </div>
          )}
          {conversation.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
              {conversation.unreadCount}
            </span>
          )}
        </div>

        {/* Content Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {conversation.customer.name}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
              {formatTime(conversation.updatedAt)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono">{conversation.customer.phone}</span>
          </div>

          {/* Needs Agent Flag */}
          {isNeedsAgent && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1 bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{conversation.needsAgentReason || 'Staff takeover requested'}</span>
            </div>
          )}

          {/* Last message preview */}
          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {conversation.lastMessage?.content || 'No messages yet'}
          </p>

          {/* Status Indicator */}
          <div className="mt-1.5 flex items-center justify-between">
            <ConversationStatusBadge status={conversation.status} />
            {conversation.assignedStaff && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[100px]">
                Agent: {conversation.assignedStaff.name.split(' ')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
