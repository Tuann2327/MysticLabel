import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Loader2, Search, AlertTriangle, PackagePlus, RefreshCw } from 'lucide-react';
import { OrderItem } from '../types';

interface OrderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (items: OrderItem[]) => void;
  existingOrders: Set<string>;
}

interface SampleLine {
  title: string;
  size: string;
  quantity: number;
}

interface PickableOrder {
  id: number;
  orderNumber: string;
  name: string;
  customer: string;
  total: string;
  financialStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  lines: SampleLine[];
}

const API_VERSION = '2024-10';
const LOOKBACK_DAYS = 5;

/* Polaris-ish status pills, so the table reads like the Shopify orders list */
type Tone = 'info' | 'attention' | 'success' | 'subdued';

const TONES: Record<Tone, string> = {
  info: 'bg-sky-100 text-sky-900 border-sky-200',
  attention: 'bg-amber-100 text-amber-900 border-amber-200',
  success: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  subdued: 'bg-gray-100 text-gray-700 border-gray-200',
};

const DOTS: Record<Tone, string> = {
  info: 'bg-sky-500',
  attention: 'bg-amber-500',
  success: 'bg-emerald-500',
  subdued: 'bg-gray-500',
};

const Badge: React.FC<{ label: string; tone: Tone }> = ({ label, tone }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap ${TONES[tone]}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${DOTS[tone]}`} />
    {label}
  </span>
);

const titleCase = (s: string) =>
  s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const paymentTone = (s: string): Tone =>
  s === 'paid' ? 'subdued' : s === 'refunded' || s === 'voided' ? 'subdued' : 'attention';

const fulfillmentTone = (s: string): Tone => (s === 'fulfilled' ? 'subdued' : 'attention');

const OrderPickerModal: React.FC<OrderPickerModalProps> = ({ isOpen, onClose, onAdd, existingOrders }) => {
  const [orders, setOrders] = useState<PickableOrder[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - LOOKBACK_DAYS);
      const params = new URLSearchParams({
        status: 'any',
        created_at_min: minDate.toISOString(),
        limit: '250',
        fields: 'id,order_number,name,created_at,cancelled_at,customer,total_price,currency,financial_status,fulfillment_status,fulfillments,line_items',
      });

      const res = await fetch(`/shopify-proxy/admin/api/${API_VERSION}/orders.json?${params}`);
      if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text().catch(() => res.statusText)}`);
      const { orders: raw = [] } = await res.json();

      const mapped: PickableOrder[] = [];
      raw.forEach((o: any) => {
        if (o.cancelled_at) return;

        // Same rule the auto-import uses: sample variants only
        const lines: SampleLine[] = [];
        (o.line_items || []).forEach((li: any) => {
          const vt: string = li.variant_title ?? '';
          if (!vt.toLowerCase().includes('sample')) return;
          const sizeMatch = vt.match(/(\d+(?:\.\d+)?)\s*ml/i);
          lines.push({
            title: String(li.title || '').replace(/^sample\s*[-–]\s*/i, '').replace(/\s+/g, ' ').trim(),
            size: sizeMatch ? sizeMatch[1] : '',
            quantity: li.quantity || 1,
          });
        });
        if (lines.length === 0) return;

        const shipment = (o.fulfillments || [])
          .map((f: any) => f.shipment_status)
          .filter(Boolean)[0];

        mapped.push({
          id: o.id,
          orderNumber: String(o.order_number),
          name: o.name || `#${o.order_number}`,
          customer: [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ')
            || o.customer?.email || '—',
          total: o.total_price ? `$${Number(o.total_price).toFixed(2)}` : '—',
          financialStatus: o.financial_status || '',
          fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
          deliveryStatus: shipment || '',
          lines,
        });
      });

      mapped.sort((a, b) => Number(b.orderNumber) - Number(a.orderNumber));
      setOrders(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      setQuery('');
      load();
    }
  }, [isOpen, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) => o.orderNumber.includes(q)
        || o.name.toLowerCase().includes(q)
        || o.customer.toLowerCase().includes(q)
        || o.lines.some((l) => l.title.toLowerCase().includes(q))
    );
  }, [orders, query]);

  if (!isOpen) return null;

  const allVisibleSelected = visible.length > 0 && visible.every((o) => selected.has(o.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((o) => next.delete(o.id));
      else visible.forEach((o) => next.add(o.id));
      return next;
    });
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedOrders = orders.filter((o) => selected.has(o.id));
  const selectedLineCount = selectedOrders.reduce((n, o) => n + o.lines.length, 0);
  const selectedSyncedCount = selectedOrders
    .filter((o) => existingOrders.has(o.orderNumber.replace(/\D/g, ''))).length;

  const handleAdd = () => {
    const items: OrderItem[] = [];
    orders.filter((o) => selected.has(o.id)).forEach((o) => {
      o.lines.forEach((l) => {
        items.push({
          id: Math.random().toString(36).slice(2, 11),
          orderNumber: o.orderNumber,
          productTitle: l.title,
          size: l.size,
          quantity: l.quantity,
        });
      });
    });
    onAdd(items);
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 apple-blur" onClick={onClose} />

      <div className="relative bg-white rounded-[20px] shadow-2xl w-full max-w-5xl h-[86vh] flex flex-col overflow-hidden border border-black/10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <PackagePlus size={18} className="text-blue-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 leading-tight">Add by order</h2>
              <p className="text-[11px] text-gray-400 font-medium truncate">
                Orders from the last {LOOKBACK_DAYS} days containing sample items
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={load}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-black rounded-lg hover:bg-black/5 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-black rounded-lg hover:bg-black/5 transition-colors" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-black/5 shrink-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={13} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order, customer, fragrance…"
              className="w-full pl-9 pr-3 py-2 bg-black/5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-[12px] font-semibold text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 size={22} className="animate-spin text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading orders</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 px-10 text-center">
              <AlertTriangle size={22} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-800">Couldn't load orders</span>
              <span className="text-xs text-gray-500 font-medium break-words max-w-md">{error}</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-center px-10">
              <span className="text-sm font-bold text-gray-800">No matching orders</span>
              <span className="text-xs text-gray-500 font-medium">
                {orders.length === 0
                  ? `No orders with sample items in the last ${LOOKBACK_DAYS} days.`
                  : 'Try a different search.'}
              </span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10 border-b border-black/10">
                <tr className="text-[11px] font-semibold text-gray-500">
                  <th className="w-10 pl-5 pr-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      className="w-[15px] h-[15px] rounded accent-blue-600 cursor-pointer align-middle"
                    />
                  </th>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Payment status</th>
                  <th className="px-3 py-2.5">Items</th>
                  <th className="px-3 py-2.5 pr-5">Delivery status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => {
                  const isSelected = selected.has(o.id);
                  const alreadySynced = existingOrders.has(o.orderNumber.replace(/\D/g, ''));
                  return (
                    <tr
                      key={o.id}
                      onClick={() => toggle(o.id)}
                      className={`border-b border-black/5 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50'}`}
                    >
                      <td className="pl-5 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(o.id)}
                          className="w-[15px] h-[15px] rounded accent-blue-600 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        {/* Same amber treatment the workbench table uses for orders
                            already written to the Google Sheet */}
                        <div
                          className="flex items-center gap-1.5"
                          title={alreadySynced ? 'Order already exists in Google Sheet' : undefined}
                        >
                          {alreadySynced && (
                            <AlertTriangle size={12} className="text-amber-500 shrink-0" fill="currentColor" />
                          )}
                          <span className={`text-[12px] font-bold ${alreadySynced ? 'text-amber-600' : 'text-gray-900'}`}>
                            {o.name}
                          </span>
                          {alreadySynced && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600/70 whitespace-nowrap">
                              Synced
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{o.customer}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-900 font-semibold text-right tabular-nums">{o.total}</td>
                      <td className="px-3 py-2.5">
                        <Badge label={titleCase(o.financialStatus) || '—'} tone={paymentTone(o.financialStatus)} />
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-600 font-medium whitespace-nowrap">
                        {o.lines.length} {o.lines.length === 1 ? 'item' : 'items'}
                      </td>
                      <td className="px-3 py-2.5 pr-5">
                        {o.deliveryStatus
                          ? <Badge label={titleCase(o.deliveryStatus)} tone="info" />
                          : <Badge label={titleCase(o.fulfillmentStatus)} tone={fulfillmentTone(o.fulfillmentStatus)} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-t border-black/5 bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {selected.size === 0
                ? `${visible.length} ${visible.length === 1 ? 'order' : 'orders'}`
                : `${selected.size} selected · ${selectedLineCount} ${selectedLineCount === 1 ? 'row' : 'rows'}`}
            </span>
            {selectedSyncedCount > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 uppercase tracking-wider whitespace-nowrap">
                <AlertTriangle size={13} />
                {selectedSyncedCount} already synced
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-black/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add {selected.size > 0 ? `${selectedLineCount} ${selectedLineCount === 1 ? 'row' : 'rows'}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPickerModal;
