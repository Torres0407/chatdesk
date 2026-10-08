import React, { useEffect, useState } from 'react';
import { Customer, Order, Booking } from '../../types';
import { api } from '../../services/api';
import {
  User,
  Phone,
  Mail,
  ShoppingBag,
  Calendar,
  Tag,
  DollarSign,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { OrderStatusBadge, BookingStatusBadge } from '../common/StatusBadge';

interface CustomerDetailPanelProps {
  customer: Customer;
  onClose?: () => void;
  onSelectOrder?: (orderId: string) => void;
  onSelectBooking?: (bookingId: string) => void;
}

export const CustomerDetailPanel: React.FC<CustomerDetailPanelProps> = ({
  customer,
  onClose,
  onSelectOrder,
  onSelectBooking,
}) => {
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.orders.list({ limit: 10 }),
      api.bookings.list(),
    ])
      .then(([ordersRes, bookingsRes]) => {
        if (!active) return;
        const matchingOrders = ordersRes.items.filter((o) => o.customerId === customer.id);
        const matchingBookings = bookingsRes.filter((b) => b.customerId === customer.id);
        setCustomerOrders(matchingOrders);
        setCustomerBookings(matchingBookings);
      })
      .catch((err) => {
        console.error('Failed to load customer relations', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customer.id]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full overflow-y-auto">
      {/* Header Profile */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 text-center relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Done
          </button>
        )}
        <div className="relative inline-block mb-2">
          {customer.avatarUrl ? (
            <img
              src={customer.avatarUrl}
              alt={customer.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 mx-auto shadow-2xs"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xl mx-auto border-2 border-slate-200 dark:border-slate-700">
              {customer.name.charAt(0)}
            </div>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{customer.name}</h3>

        {/* Masked Phone Number */}
        <div className="inline-flex items-center gap-1.5 mt-1 text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
          <Phone className="w-3 h-3 text-slate-400" />
          <span>{customer.phone}</span>
        </div>

        {customer.email && (
          <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <Mail className="w-3 h-3" />
            <span className="truncate max-w-[200px]">{customer.email}</span>
          </div>
        )}

        {/* Customer Tags */}
        {customer.tags && customer.tags.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            {customer.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Customer Quick Stats */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-850/50 text-center">
        <div>
          <div className="text-xs text-slate-400">Total Spend</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            ${customer.totalSpend.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Orders</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {customer.totalOrdersCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Bookings</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {customer.totalBookingsCount}
          </div>
        </div>
      </div>

      {/* Customer Notes */}
      {customer.notes && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-500" />
            Staff Notes
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900 leading-relaxed">
            {customer.notes}
          </p>
        </div>
      )}

      {/* Recent Orders Section */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
            Order History ({customerOrders.length})
          </div>
        </div>

        {customerOrders.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No past orders found.</p>
        ) : (
          <div className="space-y-2">
            {customerOrders.map((ord) => (
              <div
                key={ord.id}
                onClick={() => onSelectOrder && onSelectOrder(ord.id)}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer text-xs flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    {ord.orderNumber}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 transition" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDate(ord.createdAt)} · {ord.items.length} items
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    ${ord.total.toFixed(2)}
                  </div>
                  <OrderStatusBadge status={ord.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Bookings Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            Appointments & Bookings ({customerBookings.length})
          </div>
        </div>

        {customerBookings.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No bookings recorded.</p>
        ) : (
          <div className="space-y-2">
            {customerBookings.map((bkg) => (
              <div
                key={bkg.id}
                onClick={() => onSelectBooking && onSelectBooking(bkg.id)}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 transition cursor-pointer text-xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {bkg.bookingNumber}
                  </span>
                  <BookingStatusBadge status={bkg.status} />
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  {bkg.service.name}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(bkg.startTime)} at{' '}
                  {new Date(bkg.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
