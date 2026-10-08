import React from 'react';
import { ConversationStatus, OrderStatus, BookingStatus } from '../../types';

export const ConversationStatusBadge: React.FC<{ status: ConversationStatus }> = ({ status }) => {
  switch (status) {
    case 'NEEDS_AGENT':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Needs Agent
        </span>
      );
    case 'HUMAN_HANDLING':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Human Handling
        </span>
      );
    case 'OPEN':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          Bot Active
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Resolved
        </span>
      );
    default:
      return null;
  }
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const configs: Record<OrderStatus, { label: string; dot: string; text: string }> = {
    PENDING: { label: 'Pending Payment', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300' },
    PAID: { label: 'Paid', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    PREPARING: { label: 'Preparing', dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' },
    COMPLETED: { label: 'Completed', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    CANCELLED: { label: 'Cancelled', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
  };

  const item = configs[status] || { label: status, dot: 'bg-slate-400', text: 'text-slate-600' };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
};

export const BookingStatusBadge: React.FC<{ status: BookingStatus }> = ({ status }) => {
  const configs: Record<BookingStatus, { label: string; dot: string; text: string }> = {
    CONFIRMED: { label: 'Confirmed', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    COMPLETED: { label: 'Completed', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    CANCELLED: { label: 'Cancelled', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
    NO_SHOW: { label: 'No Show', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
  };

  const item = configs[status] || { label: status, dot: 'bg-slate-400', text: 'text-slate-600' };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
};
