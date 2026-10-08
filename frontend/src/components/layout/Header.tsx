import React, { useState } from 'react';
import {
  Menu,
  Sun,
  Moon,
  Bot,
  AlertTriangle,
  LogOut,
  User as UserIcon,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { apiConfig } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface HeaderProps {
  onToggleMobileNav: () => void;
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav, title }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [simulateError, setSimulateError] = useState(apiConfig.simulateErrors);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleSimulateError = () => {
    const nextVal = !simulateError;
    apiConfig.setSimulateErrors(nextVal);
    setSimulateError(nextVal);
    addToast(
      nextVal
        ? 'Simulate Errors ENABLED. API operations will now fail to demonstrate retry banners and rollback.'
        : 'Simulate Errors DISABLED. Normal API operations resumed.',
      nextVal ? 'error' : 'success',
      'API Simulation'
    );
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Open mobile navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Error Simulation Button (for evaluating error handling & retry banner) */}
        <button
          onClick={toggleSimulateError}
          title={simulateError ? 'Turn off simulated errors' : 'Turn on simulated errors to test Retry & Rollback'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
            simulateError
              ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shadow-xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${simulateError ? 'text-rose-600' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">Simulate Errors:</span>
          <span className="font-semibold">{simulateError ? 'ON' : 'OFF'}</span>
        </button>

        {/* WhatsApp Bot Status Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
          <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>WhatsApp Bot: Active</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Staff User Avatar & Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="User account menu"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-medium flex items-center justify-center text-xs">
                  {user.name.charAt(0)}
                </div>
              )}
              <div className="hidden xl:block text-left">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-none">
                  {user.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 capitalize leading-none">
                  {user.role.toLowerCase()}
                </div>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                      Role: {user.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
