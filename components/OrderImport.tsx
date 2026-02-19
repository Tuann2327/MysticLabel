
import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Plus, Trash2, Search, XCircle, Eraser, AlertTriangle, X, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { OrderItem } from '../types';

interface OrderImportProps {
  data: OrderItem[];
  onUpdate: (newData: OrderItem[]) => void;
  onSync: () => void;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  existingOrders: Set<string>;
}

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText: string;
  type: 'danger' | 'warning' | 'success';
}

const SYNC_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxecigL3qk6IbchaoXrSocL9x4dRxK9KgDek0NUZ__2NSbqkmz9xqgpm1ZWTvrZKKK5/exec";

const OrderImport: React.FC<OrderImportProps> = ({ data, onUpdate, onSync, isSyncing, setIsSyncing, existingOrders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: '',
    type: 'danger'
  });

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const openConfirm = (config: Omit<ModalState, 'isOpen'>) => setModal({ ...config, isOpen: true });

  const ensureTrailingBlank = (list: OrderItem[]): OrderItem[] => {
    if (list.length === 0) {
      return [{ id: Math.random().toString(36).substr(2, 9), orderNumber: '', productTitle: '', size: '' }];
    }
    const last = list[list.length - 1];
    const isLastEmpty = last.orderNumber.trim() === '' && last.productTitle.trim() === '' && last.size.trim() === '';
    if (!isLastEmpty) {
      return [...list, { id: Math.random().toString(36).substr(2, 9), orderNumber: '', productTitle: '', size: '' }];
    }
    return list;
  };

  useEffect(() => {
    if (data.length === 0) {
      onUpdate([{ id: Math.random().toString(36).substr(2, 9), orderNumber: '', productTitle: '', size: '' }]);
    }
  }, []);

  const itemsWithEffectiveOrders = useMemo(() => {
    let lastOrder = '';
    return data.map(item => {
      const currentOrder = item.orderNumber.trim();
      const effective = currentOrder || lastOrder;
      if (currentOrder) lastOrder = currentOrder;
      return { ...item, effectiveOrder: effective };
    });
  }, [data]);

  const processCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return;
    const newItems: OrderItem[] = [];
    lines.forEach((line) => {
      const rawCols = line.includes('\t') ? line.split('\t') : line.split(',');
      if (rawCols.length < 3) return;
      const cols = rawCols.map(c => c.replace(/^["']|["']$/g, '').trim());
      const rawOrderName = cols[0];
      const rawProductTitle = cols[1];
      const rawVariant = cols[2];
      const rawQty = parseInt(cols[3] || '1', 10);
      const orderDigits = rawOrderName.replace(/\D/g, '') || rawOrderName;
      const cleanTitle = rawProductTitle.replace(/^sample\s*-\s*/gi, '').replace(/\s+/g, ' ').trim();
      const sizeMatch = rawVariant.match(/(\d+(\.\d+)?)/);
      const cleanSize = sizeMatch ? sizeMatch[0] : '';
      for (let i = 0; i < rawQty; i++) {
        newItems.push({ id: Math.random().toString(36).substr(2, 9), orderNumber: orderDigits, productTitle: cleanTitle, size: cleanSize });
      }
    });
    onUpdate(ensureTrailingBlank(newItems));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSV(text);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleSync = () => {
    const validData = itemsWithEffectiveOrders.filter(item => item.productTitle || item.orderNumber || item.size);
    if (validData.length === 0) {
      alert("No data to sync.");
      return;
    }
    setIsSyncing(true);
    const today = new Date().toLocaleDateString();
    const payload = validData.map((item, index) => {
      const isDuplicateOrder = index > 0 && 
                              item.effectiveOrder !== '' && 
                              validData[index-1].effectiveOrder === item.effectiveOrder;
      return {
        date: index === 0 ? today : '',
        orderNumber: isDuplicateOrder ? '' : item.effectiveOrder,
        productTitle: item.productTitle,
        size: item.size
      };
    });
    fetch(SYNC_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).finally(() => {
      setTimeout(() => setIsSyncing(false), 2000);
    });
    onSync();
  };

  const updateCell = (id: string, field: keyof OrderItem, value: string) => {
    const newData = data.map(item => item.id === id ? { ...item, [field]: value } : item);
    onUpdate(ensureTrailingBlank(newData));
  };

  const deleteRow = (id: string) => {
    if (data.length === 1) {
      onUpdate([{ id: Math.random().toString(36).substr(2, 9), orderNumber: '', productTitle: '', size: '' }]);
      return;
    }
    onUpdate(ensureTrailingBlank(data.filter(item => item.id !== id)));
  };

  const handleDeleteGroupAction = (e: React.MouseEvent, effectiveOrder: string) => {
    e.stopPropagation();
    if (!effectiveOrder) return;
    openConfirm({
      title: 'Delete Order Group',
      message: `Remove all entries for Order #${effectiveOrder}?`,
      confirmText: 'Wipe Group',
      type: 'danger',
      onConfirm: () => {
        let currentLastOrder = '';
        const newData = data.filter(item => {
          const itemOrder = item.orderNumber.trim();
          const itemEffective = itemOrder || currentLastOrder;
          if (itemOrder) currentLastOrder = itemOrder;
          return itemEffective !== effectiveOrder;
        });
        onUpdate(ensureTrailingBlank(newData));
        closeModal();
      }
    });
  };

  const clearAll = () => {
    openConfirm({
      title: 'Reset Workbench',
      message: 'This will clear all imported orders. Are you sure?',
      confirmText: 'Clear Everything',
      type: 'danger',
      onConfirm: () => {
        onUpdate([{ id: Math.random().toString(36).substr(2, 9), orderNumber: '', productTitle: '', size: '' }]);
        closeModal();
      }
    });
  };

  const addRowAt = (index: number) => {
    const newItem = { id: Math.random().toString(36).substr(2, 9), orderNumber: '', productTitle: '', size: '' };
    const newData = [...data];
    newData.splice(index, 0, newItem);
    onUpdate(ensureTrailingBlank(newData));
  };

  const filteredData = itemsWithEffectiveOrders.filter(item => 
    item.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.orderNumber.includes(searchTerm) ||
    item.effectiveOrder.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 apple-blur" onClick={closeModal} />
          <div className="relative bg-white/90 apple-blur rounded-[20px] shadow-2xl w-full max-w-sm overflow-hidden border border-black/10 transition-all duration-300 transform animate-in fade-in zoom-in">
            <div className="p-8 text-center">
              <div className={`mx-auto w-12 h-12 flex items-center justify-center rounded-full mb-4 ${modal.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{modal.title}</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">{modal.message}</p>
            </div>
            <div className="bg-gray-50/50 p-4 grid grid-cols-2 gap-3 border-t border-black/5">
              <button onClick={closeModal} className="py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200/50 transition-colors text-xs">Cancel</button>
              <button onClick={modal.onConfirm} className={`py-3 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 text-xs ${modal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/10' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'}`}>
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High Fidelity Control Bar */}
      <div className="flex items-center justify-between p-5 bg-white/80 apple-blur border-b border-black/5 shrink-0">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-xl cursor-pointer transition-all font-bold text-xs shadow-sm active:scale-95">
            <Upload size={16} /> Import CSV / TXT
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
          <div className="h-6 w-px bg-black/5 mx-1" />
          <button onClick={clearAll} className="flex items-center gap-2 text-gray-400 hover:text-red-500 px-4 py-2.5 rounded-xl transition-all font-bold text-xs hover:bg-red-50 active:scale-95">
            <Eraser size={16} /> Clear Workbench
          </button>
        </div>
        
        <div className="flex items-center gap-4 flex-1 max-w-2xl justify-end">
           <div className="relative flex-1 max-w-xs group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 transition-colors group-focus-within:text-blue-500" size={16} />
            <input 
              type="text" 
              placeholder="Search orders..." 
              className="w-full pl-11 pr-4 py-3 bg-gray-100 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-xs font-semibold text-gray-900 placeholder:text-gray-400" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button 
            onClick={handleSync}
            disabled={isSyncing || data.filter(i => i.productTitle).length === 0}
            className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl transition-all font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 group ${isSyncing ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
            Sync to Canvas
          </button>
        </div>
      </div>

      {/* System Table Area */}
      <div className="flex-1 overflow-auto no-scrollbar relative bg-white">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 bg-gray-50/90 apple-blur z-20 border-b border-black/5">
            <tr>
              <th className="w-40 px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-left">Order Reference</th>
              <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-left">Label Content / Name</th>
              <th className="w-32 px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Volume</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => {
              const isDuplicateOrder = index > 0 && 
                                      item.effectiveOrder !== '' && 
                                      filteredData[index-1].effectiveOrder === item.effectiveOrder;
              const isAlreadyInSheet = item.effectiveOrder && existingOrders.has(item.effectiveOrder.replace(/\D/g, ''));
              const isBlank = !item.productTitle && !item.orderNumber && !item.size;
              
              return (
                <React.Fragment key={item.id}>
                  <tr className="h-0 relative">
                    <td colSpan={3} className="p-0">
                      <div className="absolute left-0 right-0 -top-[10px] h-5 z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <button onClick={() => addRowAt(index)} className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg transform hover:scale-125 transition-transform active:scale-90">
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  <tr className={`group transition-colors border-b border-black/5 ${isBlank ? 'opacity-30' : 'hover:bg-blue-50/30'}`}>
                    <td className="p-0 relative">
                      <div className="flex items-center group/cell h-12">
                        <input 
                          className={`w-full px-8 bg-transparent font-extrabold text-xs outline-none transition-colors ${isDuplicateOrder ? 'text-transparent' : 'text-black'} ${isAlreadyInSheet ? 'text-amber-600' : ''}`}
                          value={item.orderNumber}
                          onChange={(e) => updateCell(item.id, 'orderNumber', e.target.value)}
                          placeholder="ID"
                        />
                        {isAlreadyInSheet && !isDuplicateOrder && (
                          <div className="absolute left-2 flex items-center text-amber-500 group-hover:scale-110 transition-transform" title="Order already exists in Google Sheet">
                            <AlertTriangle size={14} fill="currentColor" className="text-amber-500" />
                          </div>
                        )}
                        {!isDuplicateOrder && item.effectiveOrder !== '' && (
                          <button 
                            onClick={(e) => handleDeleteGroupAction(e, item.effectiveOrder)}
                            className="absolute right-4 text-red-300 hover:text-red-500 opacity-0 group-hover/cell:opacity-100 transition-opacity p-1"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-0">
                      <input 
                        className="w-full h-12 px-8 bg-transparent text-gray-800 font-semibold text-xs outline-none focus:bg-white/50" 
                        value={item.productTitle} 
                        onChange={(e) => updateCell(item.id, 'productTitle', e.target.value)} 
                        placeholder="Fragrance Entry Name" 
                      />
                    </td>
                    <td className="p-0 relative">
                      <div className="flex items-center group/size h-12">
                        <input 
                          className="w-full text-center px-8 bg-transparent text-gray-900 font-black text-xs outline-none focus:bg-white/50" 
                          value={item.size} 
                          onChange={(e) => updateCell(item.id, 'size', e.target.value)} 
                          placeholder="ML" 
                        />
                        <button onClick={() => deleteRow(item.id)} className="absolute right-4 text-gray-200 hover:text-red-500 opacity-0 group-hover/size:opacity-100 transition-opacity p-1">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* High Fidelity Status Bar */}
      <div className="bg-gray-50/80 apple-blur px-8 py-4 border-t border-black/5 flex justify-between items-center text-[10px] font-bold text-gray-400 shrink-0">
        <div className="flex gap-10 items-center uppercase tracking-[0.15em]">
          <div className="flex items-center gap-3">
            <span>Entry Count</span>
            <span className="text-black bg-white px-3 py-1 rounded-lg shadow-sm border border-black/5 font-black">{data.filter(i => i.productTitle).length}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Order Groups</span>
            <span className="text-black bg-white px-3 py-1 rounded-lg shadow-sm border border-black/5 font-black">{new Set(itemsWithEffectiveOrders.filter(i => i.productTitle).map(i => i.effectiveOrder)).size}</span>
          </div>
          {data.some(item => item.effectiveOrder && existingOrders.has(item.effectiveOrder.replace(/\D/g, ''))) && (
            <div className="flex items-center gap-2 text-amber-600 animate-pulse">
              <AlertTriangle size={14} />
              <span>Duplicate Orders Detected</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-blue-500">
          <CheckCircle2 size={14} />
          <span className="italic tracking-normal">Workbench state verified. Sync protocol ready.</span>
        </div>
      </div>
    </div>
  );
};

export default OrderImport;
