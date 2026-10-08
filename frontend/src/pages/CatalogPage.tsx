import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { api } from '../services/api';
import { Modal } from '../components/common/Modal';
import { RetryBanner } from '../components/common/RetryBanner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';
import {
  Layers,
  Plus,
  Edit2,
  Power,
  PowerOff,
  Package,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    sku: '',
    category: 'Botanical Teas',
    imageUrl: '',
    stockQuantity: 10,
    inStock: true,
  });

  const { addToast } = useToast();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.products.list();
      setProducts(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load catalog products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: 15.0,
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      category: 'Botanical Teas',
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80',
      stockQuantity: 20,
      inStock: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      description: p.description,
      price: p.price,
      sku: p.sku,
      category: p.category,
      imageUrl: p.imageUrl,
      stockQuantity: p.stockQuantity,
      inStock: p.inStock,
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      if (editingProduct) {
        // Edit existing
        const prevList = [...products];
        const optimistic: Product = {
          ...editingProduct,
          ...formData,
          inStock: formData.stockQuantity > 0,
          updatedAt: new Date().toISOString(),
        };
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? optimistic : p))
        );

        try {
          const updated = await api.products.update(editingProduct.id, {
            ...formData,
            inStock: formData.stockQuantity > 0,
          });
          setProducts((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
          addToast(`Product "${updated.name}" updated`, 'success');
        } catch (err: any) {
          setProducts(prevList);
          throw err;
        }
      } else {
        // Create new
        const created = await api.products.create({
          ...formData,
          inStock: formData.stockQuantity > 0,
          disabled: false,
        });
        setProducts((prev) => [created, ...prev]);
        addToast(`Product "${created.name}" created`, 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      addToast(err?.message || 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = async (p: Product) => {
    const prevList = [...products];
    const newDisabled = !p.disabled;

    // Optimistic
    setProducts((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, disabled: newDisabled } : item))
    );

    try {
      const updated = await api.products.disable(p.id, newDisabled);
      setProducts((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      addToast(
        newDisabled
          ? `"${p.name}" disabled from WhatsApp bot catalog`
          : `"${p.name}" enabled for WhatsApp bot ordering`,
        'info'
      );
    } catch (err: any) {
      setProducts(prevList);
      addToast(err?.message || 'Failed to update product state. Rolled back.', 'error');
    }
  };

  // Filter products
  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl w-full mx-auto space-y-4">
        {/* Header and Add Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Product Catalog
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage artisanal items available for direct purchase via WhatsApp bot conversations.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>

        {/* Retry Banner */}
        {error && <RetryBanner message={error} onRetry={loadProducts} retrying={loading} />}

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, SKU..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse p-4"
              />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No products found"
            description="No items match your category selection or search keywords."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className={`flex flex-col justify-between rounded-2xl border transition overflow-hidden bg-white dark:bg-slate-900 ${
                  prod.disabled
                    ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50'
                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 shadow-2xs'
                }`}
              >
                <div>
                  {/* Image banner */}
                  <div className="relative h-44 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur-xs shadow-2xs">
                        {prod.category}
                      </span>
                    </div>
                    {prod.disabled && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider">
                        Disabled for Bot
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                        {prod.name}
                      </h3>
                      <div className="font-bold text-sm text-emerald-700 dark:text-emerald-400 shrink-0">
                        ${prod.price.toFixed(2)}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {prod.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-[11px]">{prod.sku}</span>
                      <span
                        className={`font-semibold ${
                          prod.stockQuantity > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-500'
                        }`}
                      >
                        {prod.stockQuantity > 0 ? `${prod.stockQuantity} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openEditModal(prod)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-750 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleToggleDisabled(prod)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                      prod.disabled
                        ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100'
                        : 'text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100'
                    }`}
                  >
                    {prod.disabled ? (
                      <>
                        <Power className="w-3.5 h-3.5" />
                        <span>Enable</span>
                      </>
                    ) : (
                      <>
                        <PowerOff className="w-3.5 h-3.5" />
                        <span>Disable</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        subtitle="This item will be shown to WhatsApp customers when browsing the catalog."
      >
        <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Product Title *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Cardamom & Rose Sourdough Brioche"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                SKU Code
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Botanical Teas, Artisanal Bakery..."
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Stock Quantity
              </label>
              <input
                type="number"
                min="0"
                value={formData.stockQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, stockQuantity: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="https://images.unsplash.com/..."
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Taste notes, ingredients, allergen details..."
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
              {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
