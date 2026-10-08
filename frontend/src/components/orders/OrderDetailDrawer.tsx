import React, { useEffect, useState } from 'react';
import { Order, OrderStatus } from '../../types';
import { api } from '../../services/api';
import { Drawer } from '../common/Drawer';
import { OrderStatusBadge } from '../common/StatusBadge';
import { useToast } from '../../context/ToastContext';
import {
  ShoppingBag,
  CreditCard,
  MapPin,
  FileText,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  ChefHat,
  ArrowRight,
} from 'lucide-react';

interface OrderDetailDrawerProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: (updated: Order) => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  orderId,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!orderId || !isOpen) return;
    let active = true;
    setLoading(true);
    api.orders
      .get(orderId)
      .then((res) => {
        if (active) setOrder(res);
      })
      .catch((err) => {
        if (active) addToast(err?.message || 'Failed to load order', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId, isOpen, addToast]);

  const handleTransition = async (newStatus: OrderStatus) => {
    if (!order || updating) return;
    const prevOrder = { ...order };

    // Optimistic state
    const optimistic: Order = {
      ...order,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    setOrder(optimistic);
    if (onStatusUpdated) onStatusUpdated(optimistic);
    setUpdating(true);

    try {
      const updated = await api.orders.updateStatus(order.id, newStatus);
      setOrder(updated);
      if (onStatusUpdated) onStatusUpdated(updated);
      addToast(`Order #${updated.orderNumber} updated to ${newStatus}`, 'success');
    } catch (err: any) {
      // Rollback
      setOrder(prevOrder);
      if (onStatusUpdated) onStatusUpdated(prevOrder);
      addToast(err?.message || 'Status transition failed. Rolled back.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const getValidTransitions = (status: OrderStatus): { target: OrderStatus; label: string; icon: any; variant: string }[] => {
    switch (status) {
      case 'PENDING':
        return [
          { target: 'PAID', label: 'Mark as Paid', icon: CreditCard, variant: 'bg-blue-600 hover:bg-blue-700 text-white' },
          { target: 'CANCELLED', label: 'Cancel Order', icon: XCircle, variant: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' },
        ];
      case 'PAID':
        return [
          { target: 'PREPARING', label: 'Move to Preparing', icon: ChefHat, variant: 'bg-purple-600 hover:bg-purple-700 text-white' },
          { target: 'CANCELLED', label: 'Cancel & Refund', icon: XCircle, variant: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' },
        ];
      case 'PREPARING':
        return [
          { target: 'COMPLETED', label: 'Complete & Dispatched', icon: CheckCircle2, variant: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
          { target: 'CANCELLED', label: 'Cancel Order', icon: XCircle, variant: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' },
        ];
      case 'COMPLETED':
      case 'CANCELLED':
      default:
        return [];
    }
  };

  const transitions = order ? getValidTransitions(order.status) : [];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={order ? `Order #${order.orderNumber}` : 'Order Details'}
      subtitle={order ? `Placed on ${new Date(order.createdAt).toLocaleString()}` : ''}
      width="max-w-lg"
    >
      {loading || !order ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading order details...</div>
      ) : (
        <div className="space-y-5 text-xs sm:text-sm">
          {/* Status & Transitions Banner */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Current Status
              </span>
              <OrderStatusBadge status={order.status} />
            </div>

            {/* Transition Action Buttons */}
            {transitions.length > 0 ? (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-medium text-slate-400">
                  Allowed Next Transitions:
                </div>
                <div className="flex flex-wrap gap-2">
                  {transitions.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.target}
                        onClick={() => handleTransition(t.target)}
                        disabled={updating}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${t.variant}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{updating ? 'Updating...' : t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                Terminal status reached ({order.status}). No further transitions allowed.
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Customer Details
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                {order.customer.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">{order.customer.name}</div>
                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {order.customer.phone}
                </div>
              </div>
            </div>

            {order.deliveryAddress && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{order.deliveryAddress}</span>
              </div>
            )}

            {order.notes && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="italic">Note: &ldquo;{order.notes}&rdquo;</span>
              </div>
            )}
          </div>

          {/* Line Items List */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Order Items ({order.items.length})
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {order.items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate text-xs">
                        {item.productName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Qty: {item.quantity} × ${item.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs shrink-0">
                    ${(item.quantity * item.price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery Fee</span>
                <span>${order.deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Estimated Tax</span>
                <span>${order.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Payment Method: <span className="font-mono font-medium">{order.paymentMethod}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};
