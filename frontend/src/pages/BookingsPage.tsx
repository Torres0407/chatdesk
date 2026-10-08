import React, { useState, useEffect, useCallback } from 'react';
import { Booking, BookingStatus } from '../types';
import { api } from '../services/api';
import { BookingStatusBadge } from '../components/common/StatusBadge';
import { BookingDetailDrawer } from '../components/bookings/BookingDetailDrawer';
import { RetryBanner } from '../components/common/RetryBanner';
import { EmptyState } from '../components/common/EmptyState';
import {
  Calendar as CalendarIcon,
  List,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { useLiveEvents } from '../context/LiveEventContext';

export const BookingsPage: React.FC = () => {
  const { lastEvent } = useLiveEvents();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'calendar' | 'list'
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Calendar Week State (based on reference time Oct 2026: Oct 5 - Oct 11, 2026)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date(2026, 9, 5); // Monday Oct 5, 2026
    return d;
  });

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.bookings.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setBookings(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch bookings.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    if (lastEvent?.type === 'booking.updated' && lastEvent.data.booking) {
      const updated = lastEvent.data.booking;
      setBookings((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
    }
  }, [lastEvent]);

  // Week navigation
  const prevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const nextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  // Generate 7 days for the current week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const formatDateHeader = (d: Date) => {
    const dayName = d.toLocaleDateString([], { weekday: 'short' });
    const dayNum = d.getDate();
    return { dayName, dayNum };
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const handleBookingUpdated = (updated: Booking) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl w-full mx-auto space-y-4">
        {/* Top Header & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Workshops & Appointments
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Service bookings made automatically via WhatsApp bot. Reschedule or cancel sessions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === 'calendar'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Week View</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Retry Banner */}
        {error && <RetryBanner message={error} onRetry={loadBookings} retrying={loading} />}

        {/* Filters and Week Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {(
              [
                { id: 'ALL', label: 'All Statuses' },
                { id: 'CONFIRMED', label: 'Confirmed' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'CANCELLED', label: 'Cancelled' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  statusFilter === opt.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Calendar Week Nav (if in calendar view) */}
          {viewMode === 'calendar' && (
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currentWeekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
                {new Date(
                  currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000
                ).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevWeek}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
                <button
                  onClick={nextWeek}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CALENDAR WEEK VIEW */}
        {viewMode === 'calendar' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 min-h-[500px]">
              {weekDays.map((day) => {
                const { dayName, dayNum } = formatDateHeader(day);
                const dayBookings = bookings.filter((b) =>
                  isSameDay(new Date(b.startTime), day)
                );
                const isToday = isSameDay(day, new Date(2026, 9, 8)); // Local reference time Oct 8, 2026

                return (
                  <div key={day.toISOString()} className="flex flex-col min-h-[140px] md:min-h-full">
                    {/* Day Column Header */}
                    <div
                      className={`p-3 text-center border-b border-slate-200 dark:border-slate-800 ${
                        isToday
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'bg-slate-50/60 dark:bg-slate-850/60 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wider font-semibold">
                        {dayName}
                      </div>
                      <div className="text-base font-bold mt-0.5">{dayNum}</div>
                    </div>

                    {/* Day Bookings Slots */}
                    <div className="p-2 space-y-2 flex-1 bg-slate-50/20 dark:bg-slate-900/40">
                      {dayBookings.length === 0 ? (
                        <div className="h-full flex items-center justify-center p-3 text-center text-[11px] text-slate-400 italic">
                          No slots
                        </div>
                      ) : (
                        dayBookings.map((bkg) => (
                          <div
                            key={bkg.id}
                            onClick={() => setSelectedBookingId(bkg.id)}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-emerald-400 dark:hover:border-emerald-600 shadow-2xs transition cursor-pointer text-xs group"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {bkg.bookingNumber}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {new Date(bkg.startTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <div className="font-medium text-emerald-700 dark:text-emerald-400 truncate mb-1">
                              {bkg.service.name}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{bkg.customer.name}</span>
                            </div>

                            <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                              <BookingStatusBadge status={bkg.status} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {bookings.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="No bookings recorded"
                description="No customer bookings match your selected status filter."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Booking #</th>
                      <th className="py-3.5 px-4">Service</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Date & Time</th>
                      <th className="py-3.5 px-4">Staff Host</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right sm:pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bookings.map((booking) => (
                      <tr
                        key={booking.id}
                        onClick={() => setSelectedBookingId(booking.id)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition cursor-pointer"
                      >
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900 dark:text-slate-100">
                          {booking.bookingNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {booking.service.name}
                          <div className="text-[11px] text-slate-400 font-normal">
                            {booking.service.durationMinutes} mins · ${booking.service.price.toFixed(2)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {booking.customer.name}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {booking.customer.phone}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {new Date(booking.startTime).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(booking.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {booking.assignedStaff?.name || 'Unassigned'}
                        </td>
                        <td className="py-3.5 px-4">
                          <BookingStatusBadge status={booking.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right sm:pr-6">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBookingId(booking.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Detail Drawer */}
      {selectedBookingId && (
        <BookingDetailDrawer
          bookingId={selectedBookingId}
          isOpen={!!selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          onUpdated={handleBookingUpdated}
        />
      )}
    </div>
  );
};
