import React, { useState, useEffect, useCallback } from 'react';
import { Order, OrderStatus } from '../types';
import { api } from '../services/api';
import { OrderStatusBadge } from '../components/common/StatusBadge';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import { TableSkeleton } from '../components/common/Skeleton';
import { RetryBanner } from '../components/common/RetryBanner';
import { EmptyState } from '../components/common/EmptyState';
import { Search, ShoppingBag, Eye, ArrowUpDown } from 'lucide-react';
import { useLiveEvents } from '../context/LiveEventContext';

export const OrdersPage: React.FC = () => {
  const { lastEvent } = useLiveEvents();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.orders.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery,
      });
      setOrders(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer orders.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle live event order update
  useEffect(() => {
    if (lastEvent?.type === 'order.updated' && lastEvent.data.order) {
      const updated = lastEvent.data.order;
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );
    }
  }, [lastEvent]);

  const handleOrderUpdated = (updated: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
  };

  const statusOptions: { id: 'ALL' | OrderStatus; label: string }[] = [
    { id: 'ALL', label: 'All Orders' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'PAID', label: 'Paid' },
    { id: 'PREPARING', label: 'Preparing' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl w-full mx-auto space-y-4">
        {/* Page Title & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Customer Orders
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              WhatsApp bot customer orders, payment verification, and kitchen prep workflows.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Status Filter Tabs (Segmented control) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setStatusFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === opt.id
                  ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/80 dark:border-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Retry Banner */}
        {error && <RetryBanner message={error} onRetry={loadOrders} retrying={loading} />}

        {/* Orders Table Container */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={5} cols={6} />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No orders found"
              description="No customer orders currently match your chosen status filter or search query."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Order</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Items</th>
                    <th className="py-3.5 px-4">Total</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right sm:pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {order.orderNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {order.customer.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          {order.customer.phone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="text-slate-600 dark:text-slate-300 truncate">
                          {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {order.paymentMethod.replace(/_/g, ' ')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        ${order.total.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        <OrderStatusBadge status={order.status} />
                      </td>

                      <td className="py-3.5 px-4 text-right sm:pr-6">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(order.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Drawer */}
      {selectedOrderId && (
        <OrderDetailDrawer
          orderId={selectedOrderId}
          isOpen={!!selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onStatusUpdated={handleOrderUpdated}
        />
      )}
    </div>
  );
};
