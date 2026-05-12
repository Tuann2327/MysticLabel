
import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, RefreshCw, Package, AlertCircle,
  ShoppingBag, Calendar, User, Tag, ClipboardCopy, Check, FlaskConical
} from 'lucide-react';
import { OrderItem } from '../types';

interface ShopifyCustomer {
  first_name: string;
  last_name: string;
  email: string;
}

interface ShopifyLineItem {
  id: number;
  title: string;
  variant_title: string | null;
  quantity: number;
  sku: string;
  price: string;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  fulfillment_status: string | null;
  customer: ShopifyCustomer | null;
  line_items: ShopifyLineItem[];
}

interface SampleLineItem {
  orderId: number;
  orderNumber: number;
  orderName: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  sku: string;
}

interface ShopifySampleOrdersProps {
  onImport?: (items: OrderItem[]) => void;
}

const PROXY_BASE = '/shopify-proxy';
const API_VERSION = '2024-10';

const ShopifySampleOrders: React.FC<ShopifySampleOrdersProps> = ({ onImport }) => {
  const [items, setItems] = useState<SampleLineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - 3);

      const params = new URLSearchParams({
        fulfillment_status: 'unfulfilled',
        status: 'open',
        created_at_min: minDate.toISOString(),
        limit: '250',
        fields: 'id,order_number,name,created_at,fulfillment_status,customer,line_items',
      });

      const response = await fetch(
        `${PROXY_BASE}/admin/api/${API_VERSION}/orders.json?${params}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Shopify ${response.status}: ${body || response.statusText}`);
      }

      const data = await response.json();
      const orders: ShopifyOrder[] = data.orders ?? [];

      const sampleItems: SampleLineItem[] = [];
      orders.forEach(order => {
        order.line_items.forEach(li => {
          const vt = li.variant_title ?? '';
          if (vt.toLowerCase().includes('sample')) {
            sampleItems.push({
              orderId: order.id,
              orderNumber: order.order_number,
              orderName: order.name,
              createdAt: order.created_at,
              customerName: order.customer
                ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
                : 'Guest',
              customerEmail: order.customer?.email ?? '',
              productTitle: li.title,
              variantTitle: vt,
              quantity: li.quantity,
              sku: li.sku,
            });
          }
        });
      });

      setItems(sampleItems);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleImport = () => {
    if (!onImport || items.length === 0) return;
    const orderItems: OrderItem[] = items.map(item => ({
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: item.orderNumber.toString(),
      productTitle: item.productTitle.replace(/^sample\s*[-–]\s*/i, '').trim(),
      size: extractSize(item.variantTitle),
      quantity: item.quantity,
    }));
    onImport(orderItems);
  };

  const handleCopyCSV = async () => {
    if (items.length === 0) return;
    const rows = items.map(i =>
      [i.orderName, i.productTitle, i.variantTitle, i.quantity, i.customerName, i.customerEmail].join('\t')
    );
    await navigator.clipboard.writeText(['Order\tProduct\tVariant\tQty\tCustomer\tEmail', ...rows].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-AU', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  const uniqueOrders = new Set(items.map(i => i.orderId)).size;

  return (
    <div className="flex flex-col h-full bg-white rounded-[32px] border border-black/5 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-black/5 bg-white/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-2xl flex items-center justify-center">
            <ShoppingBag size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-black tracking-tight">Sample Orders</h2>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
              Unfulfilled · Last 3 days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastFetched && !isLoading && (
            <span className="hidden sm:block text-[10px] font-semibold text-gray-300">
              {lastFetched.toLocaleTimeString()}
            </span>
          )}

          {items.length > 0 && (
            <button
              onClick={handleCopyCSV}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl font-bold text-[10px] transition-all active:scale-95"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <ClipboardCopy size={13} />}
              {copied ? 'Copied!' : 'Copy TSV'}
            </button>
          )}

          {onImport && items.length > 0 && (
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-[10px] shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            >
              Load to Workbench
            </button>
          )}

          <button
            onClick={fetchOrders}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl font-bold text-[10px] transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={22} className="text-red-500" />
            </div>
            <p className="text-sm font-bold text-red-500 mb-2">Could not load orders</p>
            <p className="text-xs text-gray-400 font-medium leading-relaxed break-all">{error}</p>
            <p className="text-[10px] text-gray-300 mt-4 font-semibold leading-relaxed">
              Make sure <code className="bg-gray-100 px-1 py-0.5 rounded">VITE_SHOPIFY_STORE</code> and{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded">VITE_SHOPIFY_TOKEN</code> are set in{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded">.env.local</code> and restart the dev server.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={28} className="animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Fetching from Shopify...
            </p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package size={22} className="text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-400">No sample orders found</p>
            <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
              No unfulfilled orders with a "Sample" variant were created in the last 3 days.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm border-b border-black/5 z-10">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Order</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Customer</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Product</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Variant</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] text-center">Qty</th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Ordered</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={`${item.orderId}-${i}`}
                  className="border-b border-black/[0.04] hover:bg-blue-50/25 transition-colors"
                >
                  <td className="px-6 py-3">
                    <span className="text-xs font-extrabold text-black tracking-tight">{item.orderName}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                        <User size={11} className="text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{item.customerName}</p>
                        <p className="text-[10px] text-gray-400 truncate">{item.customerEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs text-gray-700 font-medium">{item.productTitle}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                      <Tag size={9} />
                      {item.variantTitle}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className="text-xs font-black text-black bg-gray-50 px-2 py-0.5 rounded-md border border-black/5">
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold whitespace-nowrap">
                      <Calendar size={10} />
                      {formatDate(item.createdAt)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status bar */}
      {!isLoading && !error && items.length > 0 && (
        <div className="px-8 py-3 border-t border-black/5 bg-gray-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span>{items.length} sample line items</span>
            <span className="text-black/10">·</span>
            <span>{uniqueOrders} orders</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-500">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Live
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopifySampleOrders;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractSize(variantTitle: string): string {
  const match = variantTitle.match(/(\d+(?:\.\d+)?)\s*ml/i);
  return match ? match[1] : '';
}
