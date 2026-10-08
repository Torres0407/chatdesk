import React, { useState, useEffect, useCallback } from 'react';
import { Faq } from '../types';
import { api } from '../services/api';
import { Modal } from '../components/common/Modal';
import { RetryBanner } from '../components/common/RetryBanner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';
import {
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  Bot,
  Search,
  Hash,
  Sparkles,
} from 'lucide-react';

export const FaqsPage: React.FC = () => {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'General Inquiries',
    keywordsInput: '',
  });

  const { addToast } = useToast();

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.faqs.list();
      setFaqs(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load FAQ knowledge base.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const openCreateModal = () => {
    setEditingFaq(null);
    setFormData({
      question: '',
      answer: '',
      category: 'Delivery & Shipping',
      keywordsInput: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (faq: Faq) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      keywordsInput: faq.keywords.join(', '),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question.trim() || !formData.answer.trim()) return;

    setSaving(true);
    const keywords = formData.keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    try {
      if (editingFaq) {
        // Edit
        const prevList = [...faqs];
        const optimistic: Faq = {
          ...editingFaq,
          question: formData.question,
          answer: formData.answer,
          category: formData.category,
          keywords,
          updatedAt: new Date().toISOString(),
        };
        setFaqs((prev) =>
          prev.map((f) => (f.id === editingFaq.id ? optimistic : f))
        );

        try {
          const updated = await api.faqs.update(editingFaq.id, {
            question: formData.question,
            answer: formData.answer,
            category: formData.category,
            keywords,
          });
          setFaqs((prev) =>
            prev.map((f) => (f.id === updated.id ? updated : f))
          );
          addToast('FAQ updated for WhatsApp Bot', 'success');
        } catch (err: any) {
          setFaqs(prevList);
          throw err;
        }
      } else {
        // Create
        const created = await api.faqs.create({
          question: formData.question,
          answer: formData.answer,
          category: formData.category,
          keywords,
        });
        setFaqs((prev) => [created, ...prev]);
        addToast('New FAQ created for WhatsApp Bot', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      addToast(err?.message || 'Failed to save FAQ entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prevList = [...faqs];
    // Optimistic
    setFaqs((prev) => prev.filter((f) => f.id !== id));
    setDeleteConfirmId(null);

    try {
      await api.faqs.delete(id);
      addToast('FAQ deleted from Bot knowledge base', 'info');
    } catch (err: any) {
      setFaqs(prevList);
      addToast(err?.message || 'Failed to delete FAQ. Rolled back.', 'error');
    }
  };

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase()) ||
      f.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl w-full mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              Bot Knowledge Base (FAQs)
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900">
                Automated Replies
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ChatDesk scans these questions and trigger keywords to answer WhatsApp customer inquiries instantly without staff intervention.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bot FAQ</span>
          </button>
        </div>

        {/* Retry Banner */}
        {error && <RetryBanner message={error} onRetry={loadFaqs} retrying={loading} />}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions, keywords, categories..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>

        {/* FAQs List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse p-4"
              />
            ))}
          </div>
        ) : filteredFaqs.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="No FAQs found"
            description="No automated answers match your search keyword. Create one to equip the bot!"
          />
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                        {faq.category}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Answered automatically {faq.usageCount} times
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {faq.question}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-850/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      {faq.answer}
                    </p>

                    {/* Trigger Keywords */}
                    {faq.keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-medium">Keywords:</span>
                        {faq.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded"
                          >
                            <Hash className="w-2.5 h-2.5 text-slate-400" />
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(faq)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      aria-label="Edit FAQ"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(faq.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      aria-label="Delete FAQ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Confirm Delete prompt */}
                {deleteConfirmId === faq.id && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs">
                    <span className="text-rose-900 dark:text-rose-200 font-medium">
                      Permanently remove this automated bot answer?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(faq.id)}
                        className="px-3 py-1 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700"
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create / Edit FAQ */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingFaq ? 'Edit Bot Answer' : 'Add Bot FAQ'}
        subtitle="The WhatsApp bot will evaluate incoming messages against this question and keywords."
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Category *
            </label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Delivery & Shipping, Pricing, Allergies"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Customer Question / Topic *
            </label>
            <input
              type="text"
              required
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Do you deliver on weekends?"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Automated Bot Answer *
            </label>
            <textarea
              rows={4}
              required
              value={formData.answer}
              onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Exact response the bot will dispatch to WhatsApp..."
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Trigger Keywords (comma separated)
            </label>
            <input
              type="text"
              value={formData.keywordsInput}
              onChange={(e) => setFormData({ ...formData, keywordsInput: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. weekend, sunday, saturday, delivery hours"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingFaq ? 'Save Changes' : 'Create FAQ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
