import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  MessageSquare,
  ShoppingBag,
  Calendar,
  Layers,
  HelpCircle,
  Settings,
  MessageCircle,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  onCloseMobile?: () => void;
  needsAgentCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile, needsAgentCount = 2 }) => {
  const { user } = useAuth();

  const navItems = [
    {
      to: '/conversations',
      label: 'Inbox',
      icon: MessageSquare,
      badge: needsAgentCount > 0 ? `${needsAgentCount} alert` : undefined,
      badgeAlert: true,
    },
    {
      to: '/orders',
      label: 'Orders',
      icon: ShoppingBag,
    },
    {
      to: '/bookings',
      label: 'Bookings',
      icon: Calendar,
    },
    {
      to: '/catalog',
      label: 'Catalog',
      icon: Layers,
    },
    {
      to: '/faqs',
      label: 'Bot FAQs',
      icon: HelpCircle,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
          <MessageCircle className="w-5 h-5 fill-current" />
        </div>
        <div>
          <div className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            ChatDesk
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">
              WhatsApp
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium truncate max-w-[130px]">
            Brew & Botanica
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Desk Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    item.badgeAlert
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* WhatsApp Staff Mode Info Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Cloud API Connected
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
          Staff overrides pause automated bot replies per active WhatsApp thread.
        </p>
      </div>
    </aside>
  );
};
