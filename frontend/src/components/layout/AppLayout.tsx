import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useLiveEvents } from '../../context/LiveEventContext';

export const AppLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [needsAgentCount, setNeedsAgentCount] = useState(0);
  const location = useLocation();
  const { lastEvent } = useLiveEvents();

  useEffect(() => {
    // Refresh count of conversations needing agent
    api.conversations
      .list({ status: 'NEEDS_AGENT' })
      .then((res) => {
        setNeedsAgentCount(res.total || res.items.length);
      })
      .catch(() => {});
  }, [lastEvent]);

  // Determine current screen title from route
  const getPageTitle = (pathname: string) => {
    if (pathname.startsWith('/conversations')) return 'WhatsApp Conversations';
    if (pathname.startsWith('/orders')) return 'Customer Orders';
    if (pathname.startsWith('/bookings')) return 'Appointments & Bookings';
    if (pathname.startsWith('/catalog')) return 'Product Catalog';
    if (pathname.startsWith('/faqs')) return 'Bot Knowledge Base (FAQs)';
    if (pathname.startsWith('/settings')) return 'Business Settings';
    return 'Dashboard';
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading ChatDesk...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0 h-full">
        <Sidebar needsAgentCount={needsAgentCount} />
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full animate-in slide-in-from-left duration-200">
            <Sidebar
              needsAgentCount={needsAgentCount}
              onCloseMobile={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Header
          onToggleMobileNav={() => setMobileNavOpen(true)}
          title={getPageTitle(location.pathname)}
        />
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
