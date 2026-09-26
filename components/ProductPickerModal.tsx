import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, Search, AlertTriangle, FlaskConical } from 'lucide-react';
import { OrderItem } from '../types';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (items: OrderItem[]) => void;
}

interface SearchVariant {
  id: string;
  title: string;
  ml: number;
}

interface SearchProduct {
  id: string;
  title: string;
  vendor: string;
  image: string | null;
  variants: SearchVariant[];
}

/** variantId -> the row it will become */
type Picked = Map<string, { productTitle: string; ml: number }>;

const ProductPickerModal: React.FC<ProductPickerModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [picked, setPicked] = useState<Picked>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);

  const search = useCallback(async (term: string) => {
    const seq = ++reqSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/product-search?q=${encodeURIComponent(term)}`);
      const body = await res.json().catch(() => ({}));
      if (seq !== reqSeq.current) return; // a newer keystroke already won
      if (!res.ok) throw new Error(body.error || `Server returned ${res.status}`);
      setProducts(body.products || []);
    } catch (err) {
      if (seq === reqSeq.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === reqSeq.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPicked(new Map());
    setQuery('');
    search('');
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isOpen, search]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => search(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query, isOpen, search]);

  if (!isOpen) return null;

  const toggleVariant = (product: SearchProduct, variant: SearchVariant) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(variant.id)) next.delete(variant.id);
      else next.set(variant.id, { productTitle: product.title, ml: variant.ml });
      return next;
    });
  };

  const handleAdd = () => {
    const items: OrderItem[] = [];
    picked.forEach(({ productTitle, ml }) => {
      items.push({
        id: Math.random().toString(36).slice(2, 11),
        orderNumber: '',
        productTitle: productTitle.replace(/^sample\s*[-–]\s*/i, '').replace(/\s+/g, ' ').trim(),
        size: String(ml),
        quantity: 1,
      });
    });
    onAdd(items);
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 apple-blur" onClick={onClose} />

      <div className="relative bg-white rounded-[20px] shadow-2xl w-full max-w-3xl h-[86vh] flex flex-col overflow-hidden border border-black/10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FlaskConical size={18} className="text-blue-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 leading-tight">Add by product</h2>
              <p className="text-[11px] text-gray-400 font-medium truncate">
                Sample sizes up to 10ml · added without an order number
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-black rounded-lg hover:bg-black/5 transition-colors shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-black/5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={14} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Shopify products…"
              className="w-full pl-9 pr-9 py-2.5 bg-black/5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-[13px] font-semibold text-gray-900 placeholder:text-gray-400"
            />
            {isLoading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto px-3 py-2">
          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 px-10 text-center">
              <AlertTriangle size={22} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-800">Search failed</span>
              <span className="text-xs text-gray-500 font-medium break-words max-w-md">{error}</span>
            </div>
          ) : products.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-center px-10">
              <span className="text-sm font-bold text-gray-800">No products found</span>
              <span className="text-xs text-gray-500 font-medium">
                {query ? 'Try a different search term.' : 'No products with sample-sized variants.'}
              </span>
            </div>
          ) : (
            products.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-11 h-11 rounded-lg bg-gray-50 border border-black/5 shrink-0 overflow-hidden flex items-center justify-center">
                  {p.image
                    ? <img src={p.image} alt="" className="w-full h-full object-contain" loading="lazy" />
                    : <FlaskConical size={16} className="text-gray-300" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-gray-900 leading-tight">{p.title}</div>
                  {p.vendor && <div className="text-[11px] text-gray-400 font-medium mt-0.5">{p.vendor}</div>}

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.variants.map((v) => {
                      const on = picked.has(v.id);
                      return (
                        <button
                          key={v.id}
                          onClick={() => toggleVariant(p, v)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                            on
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-black/10 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                          }`}
                          title={v.title}
                        >
                          {v.ml}ml
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-t border-black/5 bg-gray-50/70 shrink-0">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            {picked.size === 0 ? 'Nothing selected' : `${picked.size} ${picked.size === 1 ? 'row' : 'rows'} to add`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-black/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={picked.size === 0}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add {picked.size > 0 ? `${picked.size} ${picked.size === 1 ? 'row' : 'rows'}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPickerModal;
