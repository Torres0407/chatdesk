import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-4">
        <MessageSquare className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
        Page Not Found
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
        The staff desk route you requested does not exist or has moved.
      </p>
      <Link
        to="/conversations"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Conversations</span>
      </Link>
    </div>
  );
};
