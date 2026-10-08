import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, Lock, Mail, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('chioma@brewbotanica.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/conversations';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
            <MessageCircle className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            ChatDesk
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            WhatsApp Business Staff Dashboard & Bot Management
          </p>
        </div>

        {/* Error State Banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-200 text-xs"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-snug">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              Staff Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@business.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 transition shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 mt-2"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Desk'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick-Fill Demo Profiles */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Quick Demo Sign In
          </div>
          <div className="grid grid-cols-2 gap-2 text-left">
            <button
              type="button"
              onClick={() => handleQuickLogin('chioma@brewbotanica.com')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-600 bg-slate-50 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 transition text-xs"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">Chioma Okafor</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Role: OWNER
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('david@brewbotanica.com')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-600 bg-slate-50 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 transition text-xs"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">David Adebayo</div>
              <div className="text-[10px] text-slate-500 font-medium">Role: STAFF</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
