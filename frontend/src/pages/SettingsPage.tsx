import React, { useState, useEffect, useCallback } from 'react';
import { Business, OptOut } from '../types';
import { api } from '../services/api';
import { RetryBanner } from '../components/common/RetryBanner';
import { useToast } from '../context/ToastContext';
import {
  Settings,
  Bot,
  Clock,
  Calendar,
  Store,
  UserX,
  Trash2,
  Check,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'profile' | 'hours' | 'slots' | 'optouts'>('profile');

  const { addToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [biz, opts] = await Promise.all([
        api.settings.get(),
        api.optOuts.list(),
      ]);
      setBusiness(biz);
      setOptOuts(opts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load business settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Master Bot Toggle
  const handleToggleBot = async () => {
    if (!business) return;
    const prev = { ...business };
    const nextVal = !business.botEnabled;

    const optimistic: Business = { ...business, botEnabled: nextVal };
    setBusiness(optimistic);

    try {
      const updated = await api.settings.update({ botEnabled: nextVal });
      setBusiness(updated);
      addToast(
        nextVal
          ? 'Automated WhatsApp Bot enabled for all incoming chats.'
          : 'Automated WhatsApp Bot PAUSED. All incoming chats will require manual staff takeover.',
        nextVal ? 'success' : 'info'
      );
    } catch (err: any) {
      setBusiness(prev);
      addToast(err?.message || 'Failed to update bot toggle. Rolled back.', 'error');
    }
  };

  // Save General Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    try {
      const updated = await api.settings.update({
        name: business.name,
        address: business.address,
        category: business.category,
        welcomeMessage: business.welcomeMessage,
        fallbackMessage: business.fallbackMessage,
      });
      setBusiness(updated);
      addToast('Business profile and WhatsApp greeting updated', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save Slot Rules
  const handleSaveSlotRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    try {
      const updated = await api.settings.update({
        slotRules: business.slotRules,
      });
      setBusiness(updated);
      addToast('Booking slot rules updated', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to save slot rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Remove Opt-Out
  const handleRemoveOptOut = async (id: string) => {
    const prev = [...optOuts];
    setOptOuts((prevList) => prevList.filter((o) => o.id !== id));

    try {
      await api.optOuts.remove(id);
      addToast('Customer removed from opt-out list. WhatsApp messaging re-enabled.', 'success');
    } catch (err: any) {
      setOptOuts(prev);
      addToast(err?.message || 'Failed to remove opt-out. Rolled back.', 'error');
    }
  };

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  if (loading || !business) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl w-full mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Business & Bot Settings
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure store details, WhatsApp bot automation switch, booking rules, and opt-outs.
            </p>
          </div>

          {/* Master Bot Switch Banner */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <Bot className={`w-4 h-4 ${business.botEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div className="text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Bot Auto-Responder: </span>
                <span className={business.botEnabled ? 'text-emerald-600 font-bold' : 'text-slate-400 font-bold'}>
                  {business.botEnabled ? 'ON' : 'PAUSED'}
                </span>
              </div>
            </div>
            <button
              onClick={handleToggleBot}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                business.botEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  business.botEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Retry Banner */}
        {error && <RetryBanner message={error} onRetry={loadData} retrying={loading} />}

        {/* Sub-Tabs Nav */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
          {[
            { id: 'profile', label: 'Store Profile', icon: Building },
            { id: 'hours', label: 'Opening Hours', icon: Clock },
            { id: 'slots', label: 'Service & Slot Rules', icon: Calendar },
            { id: 'optouts', label: `Opted-Out Customers (${optOuts.length})`, icon: UserX },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold border border-slate-200 dark:border-slate-800'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Store Profile & Bot Welcome Message */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
              Store & WhatsApp Identity
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={business.name}
                  onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  WhatsApp Business Phone (Masked)
                </label>
                <input
                  type="text"
                  disabled
                  value={business.phone}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Category / Industry
                </label>
                <input
                  type="text"
                  value={business.category}
                  onChange={(e) => setBusiness({ ...business, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Physical Store Address
                </label>
                <input
                  type="text"
                  value={business.address}
                  onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  WhatsApp Bot Welcome Message (Greeting)
                </label>
                <textarea
                  rows={3}
                  value={business.welcomeMessage}
                  onChange={(e) => setBusiness({ ...business, welcomeMessage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Bot Fallback / Unrecognized Intent Message
                </label>
                <textarea
                  rows={2}
                  value={business.fallbackMessage}
                  onChange={(e) => setBusiness({ ...business, fallbackMessage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs"
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Opening Hours */}
        {activeTab === 'hours' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Weekly Operating Hours
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              The WhatsApp bot notifies customers when inquiries or bookings occur outside operating hours.
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {daysOfWeek.map((day) => {
                const hourConfig = business.businessHours[day] || {
                  open: '08:00',
                  close: '18:00',
                  closed: false,
                };
                return (
                  <div key={day} className="py-2.5 flex items-center justify-between gap-4">
                    <span className="w-28 font-semibold capitalize text-slate-800 dark:text-slate-200">
                      {day}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={!hourConfig.closed}
                          onChange={(e) => {
                            const newHours = {
                              ...business.businessHours,
                              [day]: { ...hourConfig, closed: !e.target.checked },
                            };
                            setBusiness({ ...business, businessHours: newHours });
                          }}
                          className="rounded text-emerald-600"
                        />
                        <span>Open</span>
                      </label>

                      {!hourConfig.closed && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={hourConfig.open}
                            onChange={(e) => {
                              const newHours = {
                                ...business.businessHours,
                                [day]: { ...hourConfig, open: e.target.value },
                              };
                              setBusiness({ ...business, businessHours: newHours });
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={hourConfig.close}
                            onChange={(e) => {
                              const newHours = {
                                ...business.businessHours,
                                [day]: { ...hourConfig, close: e.target.value },
                              };
                              setBusiness({ ...business, businessHours: newHours });
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await api.settings.update({ businessHours: business.businessHours });
                    addToast('Opening hours updated', 'success');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Hours'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Booking Slot Rules */}
        {activeTab === 'slots' && (
          <form onSubmit={handleSaveSlotRules} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Appointment & Workshop Capacity Rules
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Controls appointment duration and concurrency limits when WhatsApp customers book tasting sessions or workshops.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Default Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={business.slotRules.slotDurationMinutes}
                  onChange={(e) =>
                    setBusiness({
                      ...business,
                      slotRules: {
                        ...business.slotRules,
                        slotDurationMinutes: parseInt(e.target.value, 10) || 45,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Buffer Between Slots (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={business.slotRules.bufferMinutes}
                  onChange={(e) =>
                    setBusiness({
                      ...business,
                      slotRules: {
                        ...business.slotRules,
                        bufferMinutes: parseInt(e.target.value, 10) || 15,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Max Concurrent Bookings
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={business.slotRules.maxConcurrentBookings}
                  onChange={(e) =>
                    setBusiness({
                      ...business,
                      slotRules: {
                        ...business.slotRules,
                        maxConcurrentBookings: parseInt(e.target.value, 10) || 4,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Slot Rules'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: Opted-Out Customers */}
        {activeTab === 'optouts' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Opted-Out Customers
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                WhatsApp Business compliance: Customers who texted &ldquo;STOP&rdquo; or requested unsubscribe. The bot blocks outbound marketing messages to these numbers.
              </p>
            </div>

            {optOuts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 italic">
                No customer opt-outs recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl overflow-hidden">
                {optOuts.map((opt) => (
                  <div key={opt.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {opt.customerName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{opt.phone}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{opt.reason}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveOptOut(opt.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 text-xs font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Opt-Out</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
