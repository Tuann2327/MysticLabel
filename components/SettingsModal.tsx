
import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Loader2, Settings, Globe } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: string[];
  wordsToRemove: string[];
  altNameDict: Record<string, string>;
  onSave: (settings: { brands: string[], wordsToRemove: string[], altNameDict: Record<string, string> }) => Promise<void>;
  isLoading: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  brands: initialBrands, 
  wordsToRemove: initialWords, 
  altNameDict: initialAltDict,
  onSave,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'brands' | 'words' | 'alt'>('brands');
  const [brands, setBrands] = useState<string[]>(initialBrands);
  const [wordsToRemove, setWordsToRemove] = useState<string[]>(initialWords);
  const [altNameDict, setAltNameDict] = useState<Record<string, string>>(initialAltDict);
  
  const [newBrand, setNewBrand] = useState('');
  const [newWord, setNewWord] = useState('');
  const [newAltKey, setNewAltKey] = useState('');
  const [newAltVal, setNewAltVal] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBrands(initialBrands);
      setWordsToRemove(initialWords);
      setAltNameDict(initialAltDict);
    }
  }, [isOpen, initialBrands, initialWords, initialAltDict]);

  if (!isOpen) return null;

  const handleAddBrand = () => {
    if (newBrand.trim()) {
      setBrands(prev => [...prev, newBrand.trim()]);
      setNewBrand('');
    }
  };

  const handleAddWord = () => {
    if (newWord.trim()) {
      setWordsToRemove(prev => [...prev, newWord.trim()]);
      setNewWord('');
    }
  };

  const handleAddAlt = () => {
    if (newAltKey.trim() && newAltVal.trim()) {
      setAltNameDict(prev => ({ ...prev, [newAltKey.trim().toLowerCase()]: newAltVal.trim() }));
      setNewAltKey('');
      setNewAltVal('');
    }
  };

  const handleRemoveBrand = (index: number) => {
    setBrands(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveWord = (index: number) => {
    setWordsToRemove(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAlt = (key: string) => {
    setAltNameDict(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    await onSave({ brands, wordsToRemove, altNameDict });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[24px] md:rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border border-black/10 flex flex-col h-[90vh] md:h-[80vh] animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-black/5 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-lg md:rounded-xl flex items-center justify-center text-blue-500">
              <Settings size={18} className="md:w-[20px] md:h-[20px]" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-black text-black tracking-tight uppercase">System Settings</h2>
              <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Pre-processing Rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black/5 px-4 md:px-6 bg-white overflow-x-auto no-scrollbar">
          {(['brands', 'words', 'alt'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {tab === 'brands' ? 'Brands' : tab === 'words' ? 'Words to Remove' : 'Alt Names'}
              {activeTab === tab && <div className="absolute bottom-0 left-4 md:left-6 right-4 md:right-6 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
          {activeTab === 'brands' && (
            <div className="space-y-6">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Add new brand..." 
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                />
                <button onClick={handleAddBrand} className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs active:scale-95 transition-all">
                  <Plus size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {brands.map((brand, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded-lg group hover:bg-gray-100 transition-all">
                    <span className="text-[11px] font-bold text-gray-700">{brand}</span>
                    <button onClick={() => handleRemoveBrand(idx)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'words' && (
            <div className="space-y-6">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Add word to remove..." 
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                />
                <button onClick={handleAddWord} className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs active:scale-95 transition-all">
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {wordsToRemove.map((word, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg group hover:bg-gray-100 transition-all">
                    <span className="text-[11px] font-bold text-gray-700">{word}</span>
                    <button onClick={() => handleRemoveWord(idx)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'alt' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="text" 
                  placeholder="Original text..." 
                  className="bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={newAltKey}
                  onChange={(e) => setNewAltKey(e.target.value)}
                />
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Replace with..." 
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={newAltVal}
                    onChange={(e) => setNewAltVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAlt()}
                  />
                  <button onClick={handleAddAlt} className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs active:scale-95 transition-all">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(altNameDict).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg group hover:bg-gray-100 transition-all">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">Replace</span>
                      <span className="text-[11px] font-bold text-gray-700">{key}</span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">With</span>
                      <span className="text-[11px] font-bold text-blue-600">{val}</span>
                    </div>
                    <button onClick={() => handleRemoveAlt(key)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 bg-gray-50 border-t border-black/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <Globe size={14} />
            Changes will sync to Google Sheets
          </div>
          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            SAVE SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
