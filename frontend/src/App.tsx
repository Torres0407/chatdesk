import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LiveEventProvider } from './context/LiveEventContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { OrdersPage } from './pages/OrdersPage';
import { BookingsPage } from './pages/BookingsPage';
import { CatalogPage } from './pages/CatalogPage';
import { FaqsPage } from './pages/FaqsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <LiveEventProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Staff Operations Shell */}
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<Navigate to="/conversations" replace />} />
                  <Route path="conversations" element={<ConversationsPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="bookings" element={<BookingsPage />} />
                  <Route path="catalog" element={<CatalogPage />} />
                  <Route path="faqs" element={<FaqsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </LiveEventProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
