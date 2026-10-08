import React, { useEffect, useState } from 'react';
import { Booking, BookingStatus } from '../../types';
import { api } from '../../services/api';
import { Drawer } from '../common/Drawer';
import { BookingStatusBadge } from '../common/StatusBadge';
import { useToast } from '../../context/ToastContext';
import {
  Calendar,
  Clock,
  User,
  Phone,
  FileText,
  AlertTriangle,
  RotateCcw,
  XCircle,
  CheckCircle2,
} from 'lucide-react';

interface BookingDetailDrawerProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updated: Booking) => void;
}

export const BookingDetailDrawer: React.FC<BookingDetailDrawerProps> = ({
  bookingId,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Reschedule Form state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00');

  // Cancel Form state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation via WhatsApp');

  const { addToast } = useToast();

  useEffect(() => {
    if (!bookingId || !isOpen) return;
    let active = true;
    setLoading(true);
    api.bookings
      .get(bookingId)
      .then((res) => {
        if (active) {
          setBooking(res);
          const start = new Date(res.startTime);
          setRescheduleDate(start.toISOString().split('T')[0]);
          setRescheduleTime(
            `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
          );
        }
      })
      .catch((err) => {
        if (active) addToast(err?.message || 'Failed to load booking details', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookingId, isOpen, addToast]);

  const handleCancelBooking = async () => {
    if (!booking) return;
    const prev = { ...booking };
    const optimistic: Booking = {
      ...booking,
      status: 'CANCELLED',
      cancellationReason: cancelReason,
      updatedAt: new Date().toISOString(),
    };
    setBooking(optimistic);
    if (onUpdated) onUpdated(optimistic);
    setActionLoading(true);

    try {
      const updated = await api.bookings.cancel(booking.id, cancelReason);
      setBooking(updated);
      if (onUpdated) onUpdated(updated);
      setShowCancel(false);
      addToast(`Booking #${updated.bookingNumber} was cancelled.`, 'info');
    } catch (err: any) {
      setBooking(prev);
      if (onUpdated) onUpdated(prev);
      addToast(err?.message || 'Cancellation failed. Rolled back.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleBooking = async () => {
    if (!booking || !rescheduleDate || !rescheduleTime) return;
    const prev = { ...booking };
    const newStartISO = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();

    const optimistic: Booking = {
      ...booking,
      startTime: newStartISO,
      status: 'CONFIRMED',
      updatedAt: new Date().toISOString(),
    };
    setBooking(optimistic);
    if (onUpdated) onUpdated(optimistic);
    setActionLoading(true);

    try {
      const updated = await api.bookings.reschedule(booking.id, newStartISO);
      setBooking(updated);
      if (onUpdated) onUpdated(updated);
      setShowReschedule(false);
      addToast(`Booking #${updated.bookingNumber} rescheduled to ${rescheduleDate} ${rescheduleTime}.`, 'success');
    } catch (err: any) {
      setBooking(prev);
      if (onUpdated) onUpdated(prev);
      addToast(err?.message || 'Rescheduling failed. Rolled back.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={booking ? `Booking #${booking.bookingNumber}` : 'Booking Details'}
      subtitle={booking ? booking.service.name : ''}
      width="max-w-lg"
    >
      {loading || !booking ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading booking...</div>
      ) : (
        <div className="space-y-4 text-xs sm:text-sm">
          {/* Status & Service Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </span>
              <BookingStatusBadge status={booking.status} />
            </div>

            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {booking.service.name}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{booking.service.durationMinutes} mins</span>
              </div>
              <div>·</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                ${booking.service.price.toFixed(2)}
              </div>
            </div>

            {booking.assignedStaff && (
              <div className="text-xs text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800">
                Assigned Specialist: <span className="font-semibold text-slate-700 dark:text-slate-200">{booking.assignedStaff.name}</span>
              </div>
            )}
          </div>

          {/* Time & Date */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Scheduled Appointment
            </div>
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>
                {new Date(booking.startTime).toLocaleDateString([], {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Customer Profile */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Customer Info
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold flex items-center justify-center text-xs">
                {booking.customer.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">{booking.customer.name}</div>
                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{booking.customer.phone}</div>
              </div>
            </div>
            {booking.notes && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>Notes: &ldquo;{booking.notes}&rdquo;</span>
              </div>
            )}
            {booking.cancellationReason && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-xs">
                Reason for Cancellation: {booking.cancellationReason}
              </div>
            )}
          </div>

          {/* Action Modals / Forms: Reschedule */}
          {showReschedule && (
            <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/30 space-y-3">
              <div className="font-semibold text-purple-900 dark:text-purple-200 text-xs">
                Reschedule Booking Date & Time
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowReschedule(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRescheduleBooking}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  Confirm Reschedule
                </button>
              </div>
            </div>
          )}

          {/* Action Modals / Forms: Cancel */}
          {showCancel && (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 space-y-3">
              <div className="font-semibold text-rose-900 dark:text-rose-200 text-xs">
                Cancel Booking
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Cancellation Reason
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowCancel(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          )}

          {/* Action Trigger Buttons */}
          {booking.status === 'CONFIRMED' && !showReschedule && !showCancel && (
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowReschedule(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reschedule</span>
              </button>
              <button
                onClick={() => setShowCancel(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Booking</span>
              </button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};
