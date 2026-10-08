import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface RetryBannerProps {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}

export const RetryBanner: React.FC<RetryBannerProps> = ({
  message = 'Failed to load data. The server might be unreachable.',
  onRetry,
  retrying = false,
}) => {
  return (
    <div
      role="alert"
      className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 p-4 mb-4 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
        <div className="text-sm font-medium">{message}</div>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shrink-0"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
        <span>{retrying ? 'Retrying...' : 'Retry'}</span>
      </button>
    </div>
  );
};
