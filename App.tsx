
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Database, Loader2, FileText, ChevronDown, Layers, RotateCcw, ClipboardList, LayoutGrid, Zap, Printer, MousePointer2, CheckCircle2, Settings2, Sliders } from 'lucide-react';
import { LayoutType, AppTab, LAYOUT_CONFIGS, OrderItem } from './types';
import Grid from './components/Grid';
import OrderImport from './components/OrderImport';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1sedz_9daFaNyFBo5QpEj06dzm7BiT3Pz1BAUwj5XXu0/export?format=csv&gid=0";
const LOGO_URL = "https://mysticperfume.com/cdn/shop/files/MYSTIC_PERFUME_LOGO_600_x_300_px_38fd0169-c15a-4ba4-bff4-8bc2702702b7.png?v=1744734157&width=200";

const preprocessText = (text: string): string => {
  if (!text) return '';
  const brands = ["Amouage","BDK Parfums","Boadicea","Bond No.9","Bvlgari",
                  "Byredo","Clive Christian","Celine","Creed","D'Annam",
                  "Diptyque","Electimuss","Ella K","Ermenegildo Zegna","Essential Parfums",
                  "Ex Nihilo","Fugazzi","Fragrance Du Bois","Frederic Malle","Giardini Di Toscana",
                  "Goldfield & Banks","Guerlain","Initio","Jo Malone","Jovoy","Kajal","Kayali",
                  "Kilian","Le Labo","Lorenzo Pazzaglia","Louis Vuitton","Loumari","Maison Crivelli",
                  "Maison Francis Kurkdjian","Maison Mataha","Mancera","Matiere Premiere","Memo Paris",
                  "Mes Bisous","Mind Games","M.Micallef","Nasomatto","Nishane","Orto Parisi",
                  "Parfums de marly","Penhaligons","Roja","Room 1015","Scents Of Wood","Serge Lutens",
                  "Simone Andreoli","Sospiro","Sora Dora","Stephane Humbert Lucas","The Harmonist",
                  "Tom Ford","Une Nuit Nomade","Xerjoff","YSL","Zoologist","Yves Saint Laurent"];
  const wordsToRemove = ["Le Vestiaire Des Parfums"];
  const altNameDict: Record<string, string> = {
    "baccarat rouge": "Baccarat Rouge 540",
    "ambre noir": "Ambre Noir"
  };
  let result = text.toString();
  brands.forEach(b => {
    const re = new RegExp('\\b' + b.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','gi');
    result = result.replace(re,'');
  });
  wordsToRemove.forEach(w => {
    const re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','gi');
    result = result.replace(re,'');
  });
  result = result.replace(/\s+/g,' ').replace(/^sample\s*-\s*/i, '').trim();
  const lower = result.toLowerCase();
  for (const [key, value] of Object.entries(altNameDict)) {
    if (key.toLowerCase() === lower) return value;
  }
  return result;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('import');
  const [layoutType, setLayoutType] = useState<LayoutType>('standard');
  const [selectedSize, setSelectedSize] = useState<string>('1ml');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set<number>());
  const [mappedData, setMappedData] = useState<Record<number, string>>({});
  const [importedItems, setImportedItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [existingOrders, setExistingOrders] = useState<Set<string>>(new Set());

  const fetchExistingOrders = useCallback(async () => {
    try {
      const response = await fetch(`${SHEET_URL}&cachebust=${Date.now()}`);
      const text = await response.text();
      const orders = new Set<string>();
      text.split('\n').forEach(row => {
        const columns = row.split(',').map(c => c.replace(/"/g, '').trim());
        // Assuming Col B (index 1) is Order Number based on sync payload
        if (columns.length > 1 && columns[1]) {
          const order = columns[1].replace(/\D/g, '');
          if (order) orders.add(order);
        }
      });
      setExistingOrders(orders);
    } catch (err) {
      console.error("Failed to fetch existing orders:", err);
    }
  }, []);

  const sizeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    importedItems.forEach(item => {
      if (!item.size) return;
      const numericPart = item.size.toLowerCase().replace('ml', '').trim();
      if (!numericPart) return;
      const cleanSize = numericPart + 'ml';
      counts[cleanSize] = (counts[cleanSize] || 0) + 1;
    });
    return counts;
  }, [importedItems]);

  useEffect(() => {
    fetchExistingOrders();

    const config = LAYOUT_CONFIGS[layoutType];
    setSelectedSize(config.options[0]);
    setSelectedIndices(new Set<number>());
    setMappedData({});
  }, [layoutType]);

  const handleResetGrid = useCallback(() => {
    setMappedData({});
    setSelectedIndices(new Set<number>());
  }, []);

  const fetchAndMapData = async () => {
    if (selectedIndices.size === 0) {
      alert("Please select target cells on the grid first.");
      return;
    }
    setIsLoading(true);
    try {
      let filteredNames: string[] = [];
      const numericTarget = selectedSize.replace('ml', '').trim().toLowerCase();
      if (importedItems.length > 0) {
        filteredNames = importedItems
          .filter(item => {
            if (!item.productTitle && !item.orderNumber && !item.size) return false;
            const itemSize = item.size.toLowerCase().trim();
            return itemSize === numericTarget;
          })
          .map(item => item.productTitle);
      } else {
        const response = await fetch(`${SHEET_URL}&cachebust=${Date.now()}`);
        const text = await response.text();
        const entries = text.split('\n').map(row => {
          const columns = row.split(',').map(c => c.replace(/"/g, '').trim());
          if (columns.length < 3) return null;
          const rawSizeText = columns[2];
          const sizeMatch = rawSizeText.match(/(\d+(\.\d+)?)/);
          const cleanSize = sizeMatch ? sizeMatch[0] : '';
          return { name: preprocessText(columns[1]), size: cleanSize };
        }).filter((entry): entry is {name: string, size: string} => entry !== null && entry.name.length > 0);
        filteredNames = entries
          .filter(entry => entry.size === numericTarget)
          .map(entry => entry.name);
      }
      if (filteredNames.length === 0) {
        alert(`No items found for size ${selectedSize}. Check your imported items.`);
        setIsLoading(false);
        return;
      }
      const config = LAYOUT_CONFIGS[layoutType];
      const sortedTarget = Array.from(selectedIndices).sort((a: number, b: number) => a - b);
      const newMappings: Record<number, string> = { ...mappedData };
      sortedTarget.forEach((cellIdx: number, i: number) => {
        if (filteredNames[i]) {
          newMappings[cellIdx] = filteredNames[i];
        }
      });
      setMappedData(newMappings);
      setSelectedIndices(new Set<number>());
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCell = useCallback((index: number, forceState?: boolean) => {
    setSelectedIndices(prev => {
      const next = new Set<number>(prev);
      const isSelected = forceState !== undefined ? forceState : !next.has(index);
      if (isSelected) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);

  const selectAll = () => {
    const config = LAYOUT_CONFIGS[layoutType];
    const total = config.rows * config.cols;
    const all = new Set<number>();
    for (let i = 0; i < total; i++) all.add(i);
    setSelectedIndices(all);
  };

  const generatePrint = () => {
    const totalMapped = Object.keys(mappedData).length;
    if (totalMapped === 0) {
      alert("Please map some labels to the grid before printing.");
      return;
    }
    const config = LAYOUT_CONFIGS[layoutType];
    const totalGridCells = config.rows * config.cols;
    let labelsHtml = '';
    for (let i = 0; i < totalGridCells; i++) {
      const value = mappedData[i] || '';
      labelsHtml += `
      <div class="label-cell">
        <div class="text-box">
          <span class="fit-text">${preprocessText(value)}</span>
        </div>
        <div class="brand-box">
          <span class="fit-text">
          ${value ? '<img src="https://i.postimg.cc/K8sVw3Dw/Mystic-Logo.png">' : ""}
          </span>
        </div>
      </div>`;
    }

    const isLarge = layoutType === 'large';
    const fileName = isLarge ? 'label5ml.pdf' : 'label3ml.pdf';
    
    const containerStyle = isLarge 
      ? `display: grid; grid-auto-flow: column; grid-template-rows: repeat(${config.rows}, 1in); grid-template-columns: repeat(${config.cols}, 2.5935in); gap: 0 0.14in; padding: 0.5in 0.21975in;` 
      : `display: grid; grid-auto-flow: column; grid-template-rows: repeat(${config.rows}, 0.5in); grid-template-columns: repeat(${config.cols}, 1in); gap: 0; padding: 0.5in 0.25in;`;
    
    const labelCellStyle = isLarge
      ? 'width: 2.5935in; height: 1in; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box;'
      : 'width: 1in; height: 0.5in; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box;';

    const textBoxStyle = isLarge ? 'width: 100%; height: 75%; padding: 15px 15px 0px 15px; margin: 0; box-sizing: border-box;' : 'width: 100%; height: 70%; padding: 2.5px 5px 0px 2.5px; margin: 0; box-sizing: border-box; display: flex; justify-content: center; align-items: center; flex-direction: row;';
    const brandBoxStyle = isLarge ? 'width: 100%; height: 20%; padding: 5px; margin: 0; box-sizing: border-box;' : 'width: 100%; height: 30%; padding: 0 0.5px 2px 0.5px; margin: 0; box-sizing: border-box;';

    const fitTextStyle = isLarge 
      ? 'font-family: "League Spartan", sans-serif; text-transform: uppercase; width: 100%; height: 100%; text-align: center; display: flex; align-items: center; justify-content: center; font-size: 25px; line-height: 1; font-weight: 400; letter-spacing: 8px; padding-left: 8px;' 
      : 'font-family: "League Spartan", sans-serif; text-transform: uppercase; width: 100%; height: 100%; text-align: center; display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; font-weight: 400; letter-spacing: 3px; padding-left: 3px;';
    
    const imgStyle = isLarge ? 'margin-left: -8px; width: 70%;' : 'margin-left: -6px; width: 80%;';
    const scale = isLarge ? 3 : 5;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mystic Print Preview</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@100..900&display=swap" rel="stylesheet">
    <style>
      body { margin: 0; padding: 40px; font-family: -apple-system, sans-serif; background: #f5f5f7; display: flex; flex-direction: column; align-items: center; }
      .container { position: absolute; left: -9999px; width: 8.5in; height: 11in; box-sizing: border-box; background: white; ${containerStyle} }
      .label-cell { ${labelCellStyle} }
      .brand-box { ${brandBoxStyle} }
      .text-box { ${textBoxStyle} }
      .fit-text { ${fitTextStyle} }
      .fit-text img { ${imgStyle} }
      .controls { margin-top: 30px; padding: 24px; background: white; border-radius: 12px; border: 1px solid #e5e5e5; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      #download-btn { background: #007aff; border: none; padding: 12px 32px; color: white; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; transition: 0.2s; }
      #download-btn:hover { background: #0063cc; }
    </style>
  </head>
  <body>
    <div id="container" class="container">${labelsHtml}</div>
    <div class="controls" id="controls">
      <div style="font-size: 14px; color: #86868b; margin-bottom: 8px; font-weight: 500;" id="status-text">Preparing your professional label sheet...</div>
      <div id="loader" style="margin: 20px auto; width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #007aff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    </div>
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
    <script>
      function autoFitText(el) {
        let fontSize = parseInt(window.getComputedStyle(el).fontSize);
        while ((el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) && fontSize > 6) {
          fontSize--;
          el.style.fontSize = fontSize + "px";
        }
      }
      
      window.onload = function() {
        document.querySelectorAll('.fit-text').forEach(autoFitText);
        // Auto-trigger PDF generation
        setTimeout(() => {
          downloadElementAsPdf('container', '${fileName}');
        }, 800);
      };

      async function downloadElementAsPdf(elementId, fileName) {
        const statusText = document.getElementById('status-text');
        
        try {
          const { jsPDF } = window.jspdf;
          const element = document.getElementById(elementId);
          
          const canvas = await html2canvas(element, {
            scale: ${scale},
            useCORS: true,
            backgroundColor: "#ffffff"
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          
          let pdf;
          pdf = new jsPDF({
              orientation: "portrait",
              unit: "in",
              format: "letter"
            });
          pdf.addImage(imgData, 'JPEG', 0, 0, 8.5, 11);
          
          const blobUrl = pdf.output('bloburl');
          window.location.replace(blobUrl);
        } catch (err) {
          console.error(err);
          statusText.innerHTML = "Error generating PDF. Please close this tab and try again.";
          statusText.style.color = "#ff3b30";
        }
      }
    </script>
  </body>
</html>`;
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  };

  const currentConfig = LAYOUT_CONFIGS[layoutType];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f5f5f7]">
      {/* Apple Vibrant Header / Global Toolbar */}
      <header className="no-print apple-blur sticky top-0 z-50 bg-white/75 border-b border-black/5 px-6 h-20 flex items-center shrink-0">
        <div className="max-w-[1600px] mx-auto w-full flex items-center justify-center relative">
          {/* Left: Logo */}
          <div className="absolute left-0 flex items-center gap-3">
            <img src={LOGO_URL} alt="Mystic Label" className="h-9 w-auto object-contain" />
            <div className="h-5 w-px bg-black/10 mx-2" />
            <div className="flex flex-col">
              <h1 className="text-sm font-extrabold tracking-tight text-black leading-none uppercase">Mystic Label</h1>
              <span className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-widest">Creative Suite</span>
            </div>
          </div>
          
          {/* Center: Tabs */}
          <div className="ios-segmented-control p-1 bg-black/5 rounded-2xl flex items-center">
            <button 
              onClick={() => setActiveTab('import')}
              className={`px-10 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'import' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList size={18} /> Import Data
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('grid')}
              className={`px-10 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutGrid size={18} /> Label Print
              </div>
            </button>
          </div>

          {/* Right: Status */}
          <div className="absolute right-0 flex items-center gap-5">
            {isBackgroundSyncing && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 px-3 py-1 bg-blue-50 rounded-full animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                <span>CLOUD SYNC</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-black/5 px-4 py-1.5 rounded-full border border-black/5">
               <Zap size={12} className="text-amber-500" fill="currentColor" />
               <span className="text-[10px] font-black text-black/30">V1.0 PRO</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'grid' ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f5f5f7] overflow-hidden p-6">
            <div className="flex flex-row items-stretch gap-6 h-full min-h-0">
              {/* Workspace Area - Sheet View */}
              <div className="h-full shadow-xl rounded-sm overflow-hidden aspect-[8.5/11] bg-white shrink-0">
                <Grid config={currentConfig} selectedIndices={selectedIndices} onToggleCell={handleToggleCell} mappedData={mappedData} />
              </div>

              {/* macOS Inspector Toolbar (Floating Sidebar next to Grid) */}
              <aside className="no-print w-72 bg-white/95 apple-card rounded-[24px] flex flex-col shrink-0 shadow-xl border border-black/5 h-full">
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  
                  {/* Format Settings */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Settings2 size={14} className="text-blue-500" />
                      <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Inspector</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Format Layout</label>
                        <div className="relative group">
                          <select 
                            value={layoutType}
                            onChange={(e) => setLayoutType(e.target.value as LayoutType)}
                            className="w-full bg-gray-50 border-none rounded-lg px-3 py-2.5 text-xs font-bold appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer hover:bg-gray-100"
                          >
                            <option value="standard">1ml/3ml Small (8x20)</option>
                            <option value="large">5ml/10ml Large (3x10)</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Size Capacity</label>
                        <div className="relative group">
                          <select 
                            value={selectedSize}
                            onChange={(e) => setSelectedSize(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-lg px-3 py-2.5 text-xs font-bold appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer hover:bg-gray-100"
                          >
                            {currentConfig.options.map(opt => (
                              <option key={opt} value={opt}>
                                {opt} {sizeCounts[opt] ? `(${sizeCounts[opt]} items)` : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                        </div>
                        {sizeCounts[selectedSize] > 0 && (
                          <p className="text-[9px] font-bold text-blue-500 mt-1.5 ml-1 flex items-center gap-1.5">
                            <Zap size={10} />
                            {sizeCounts[selectedSize]} items found for this size
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Stats Counter Section */}
                  <section className="bg-gray-50 rounded-xl p-4 space-y-3 border border-black/5">
                     <div className="flex justify-between items-center">
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Selected</span>
                       <span className="text-[10px] font-black text-black bg-white px-2 py-0.5 rounded-md border border-black/5 shadow-sm">{selectedIndices.size}</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Mapped</span>
                       <span className="text-[10px] font-black text-black bg-white px-2 py-0.5 rounded-md border border-black/5 shadow-sm">{Object.keys(mappedData).length}</span>
                     </div>
                  </section>

                  <div className="h-px bg-black/5 mx-2" />

                  {/* Data Mapping */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Sliders size={14} className="text-gray-400" />
                      <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Workbench</h3>
                    </div>
                    <div className="space-y-3">
                      <button 
                        onClick={fetchAndMapData}
                        disabled={isLoading || selectedIndices.size === 0}
                        className={`w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-3 rounded-xl transition-all font-bold text-xs active:scale-95 shadow-sm ${(isLoading || selectedIndices.size === 0) ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                        Auto-Map
                      </button>
                    </div>
                  </section>
                  
                  <div className="h-px bg-black/5 mx-2" />

                  {/* Selection Tools */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <MousePointer2 size={14} className="text-gray-400" />
                      <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Selection</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={selectAll} className="flex-1 bg-white border border-black/10 hover:bg-gray-50 px-2 py-2.5 rounded-lg transition-all font-bold text-[10px] text-gray-600 active:scale-95 shadow-sm">
                        Select All
                      </button>
                      <button onClick={handleResetGrid} className="flex-1 bg-white border border-black/10 hover:bg-red-50 hover:text-red-500 px-2 py-2.5 rounded-lg transition-all font-bold text-[10px] text-gray-600 active:scale-95 shadow-sm">
                        Clear Grid
                      </button>
                    </div>
                  </section>

                </div>

                {/* Main Print Action Panel */}
                <div className="p-5 bg-gray-50/50 border-t border-black/5 rounded-b-[24px]">
                  <button 
                    onClick={generatePrint}
                    disabled={Object.keys(mappedData).length === 0}
                    className={`w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-[16px] transition-all font-black text-xs shadow-lg shadow-blue-500/20 active:scale-95 ${Object.keys(mappedData).length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <Printer size={16} />
                    GENERATE PDF
                  </button>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-10 max-w-7xl mx-auto w-full overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col bg-white apple-card rounded-[32px] border border-black/5 shadow-2xl">
              <OrderImport 
                data={importedItems} 
                onUpdate={setImportedItems} 
                onSync={() => {
                  setIsBackgroundSyncing(true);
                  fetchExistingOrders();
                  setActiveTab('grid');
                }}
                isSyncing={isBackgroundSyncing}
                setIsSyncing={setIsBackgroundSyncing}
                existingOrders={existingOrders}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
