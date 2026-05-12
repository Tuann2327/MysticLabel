
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Loader2, FileText, ChevronDown, RotateCcw, ClipboardList, LayoutGrid, Zap, Printer, MousePointer2, Settings2, Search } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { LayoutType, AppTab, LAYOUT_CONFIGS, OrderItem } from './types';
import Grid from './components/Grid';
import OrderImport from './components/OrderImport';
import SettingsModal from './components/SettingsModal';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1qf0W26PS1t4SRfga7eCbFBXHnQii4r3mtdNhiA37eEc/export?format=csv&gid=0";
const SETTINGS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1qf0W26PS1t4SRfga7eCbFBXHnQii4r3mtdNhiA37eEc/export?format=csv&gid=59548729";
const PREPARED_SHEET_URL = "https://docs.google.com/spreadsheets/d/1qf0W26PS1t4SRfga7eCbFBXHnQii4r3mtdNhiA37eEc/export?format=csv&gid=1350505644";
const SETTINGS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwY_PI1Q89G8HtqHGYmvQQlDOxuGaMKOoaMgjiiGI39o3X16rDLVForSmE7jWR_omTj7Q/exec";
const LOGO_URL = "https://mysticperfume.com/cdn/shop/files/MYSTIC_PERFUME_LOGO_600_x_300_px_38fd0169-c15a-4ba4-bff4-8bc2702702b7.png?v=1744734157&width=200";

const DEFAULT_BRANDS = ["Amouage","BDK Parfums","Boadicea","Bond No.9","Bvlgari",
                  "Byredo","Clive Christian","Celine","Creed","D'Annam",
                  "Diptyque","Electimuss","Ella K","Ermenegildo Zegna","Essential Parfums",
                  "Ex Nihilo","Fugazzi","Fragrance Du Bois","Frederic Malle","Giardini Di Toscana",
                  "Goldfield & Banks","Guerlain","Initio","Jo Malone","Jovoy","Kajal","Kayali",
                  "Kilian","Le Labo","Lorenzo Pazzaglia","Louis Vuitton","Loumari","Maison Crivelli",
                  "Maison Francis Kurkdjian","Maison Mataha","Mancera","Matiere Premiere","Memo Paris",
                  "Mes Bisous","Mind Games","M.Micallef","Nasomatto","Nishane","Orto Parisi",
                  "Parfums de Marly","Penhaligons","Roja","Room 1015","Scents Of Wood","Serge Lutens",
                  "Simone Andreoli","Sospiro","Sora Dora","Stephane Humbert Lucas","The Harmonist",
                  "Tom Ford","Une Nuit Nomade","Xerjoff","YSL","Zoologist","Yves Saint Laurent", "Stéphane Humbert Lucas"];

const DEFAULT_WORDS_TO_REMOVE = ["Le Vestiaire Des Parfums"];

const DEFAULT_ALT_NAME_DICT: Record<string, string> = {
  "baccarat rouge": "Baccarat Rouge 540",
  "ambre noir": "Ambre Noir"
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
  const [previousMappedData, setPreviousMappedData] = useState<Record<number, string> | null>(null);
  
  // Settings State
  const [brands, setBrands] = useState<string[]>(DEFAULT_BRANDS);
  const [wordsToRemove, setWordsToRemove] = useState<string[]>(DEFAULT_WORDS_TO_REMOVE);
  const [altNameDict, setAltNameDict] = useState<Record<string, string>>(DEFAULT_ALT_NAME_DICT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const preprocessText = useCallback((text: string): string => {
    if (!text) return '';
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
    const entries = Object.entries(altNameDict) as [string, string][];
    for (const [key, value] of entries) {
      if (key.toLowerCase() === lower) return value;
    }
    return result;
  }, [brands, wordsToRemove, altNameDict]);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${SETTINGS_SHEET_URL}&cachebust=${Date.now()}`);
      if (!response.ok) return;
      const text = await response.text();
      const rows = text.split('\n').map(row => row.split(',').map(c => c.replace(/"/g, '').trim()));
      
      const newBrands: string[] = [];
      const newWords: string[] = [];
      const newAlt: Record<string, string> = {};

      rows.forEach((cols: string[]) => {
        if (cols.length < 2) return;
        const type = cols[0].toUpperCase();
        const val = cols[1];
        if (type === 'BRAND') newBrands.push(val);
        else if (type === 'WORD') newWords.push(val);
        else if (type === 'ALT' && cols.length >= 3) newAlt[val.toLowerCase()] = cols[2];
      });

      if (newBrands.length > 0) setBrands(newBrands);
      if (newWords.length > 0) setWordsToRemove(newWords);
      if (Object.keys(newAlt).length > 0) setAltNameDict(newAlt);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  const saveSettings = async (newSettings: { brands: string[], wordsToRemove: string[], altNameDict: Record<string, string> }) => {
    setIsSettingsLoading(true);
    try {
      const payload: any[] = [];
      newSettings.brands.forEach(b => payload.push({ type: 'BRAND', val: b }));
      newSettings.wordsToRemove.forEach(w => payload.push({ type: 'WORD', val: w }));
      Object.entries(newSettings.altNameDict).forEach(([k, v]) => payload.push({ type: 'ALT', val: k, val2: v }));

      await fetch(SETTINGS_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveSettings', data: payload })
      });

      setBrands(newSettings.brands);
      setWordsToRemove(newSettings.wordsToRemove);
      setAltNameDict(newSettings.altNameDict);
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save settings to Google Sheets.");
    } finally {
      setIsSettingsLoading(false);
    }
  };

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
      if (!item.productTitle || !item.size) return;
      const key = item.size.toLowerCase().replace('ml', '').trim() + 'ml';
      counts[key] = (counts[key] || 0) + (item.quantity || 1);
    });
    return counts;
  }, [importedItems]);

  useEffect(() => {
    fetchExistingOrders();

    const config = LAYOUT_CONFIGS[layoutType];
    setSelectedSize(config.options[0]);
    setSelectedIndices(new Set<number>());
    setMappedData({});
    fetchSettings();
  }, [layoutType]);

  const handleResetGrid = useCallback(() => {
    setMappedData({});
    setSelectedIndices(new Set<number>());
    setPreviousMappedData(null);
  }, []);

  const handleClearCell = useCallback((index: number) => {
    setMappedData((prev: Record<number, string>) => {
      setPreviousMappedData((current: Record<number, string> | null) => current ?? { ...prev });
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (previousMappedData !== null) {
      setMappedData(previousMappedData);
      setPreviousMappedData(null);
      setSelectedIndices(new Set<number>());
    }
  }, [previousMappedData]);

  const fetchAndMapData = async (overrideIndices?: Set<number>, overrideSize?: string) => {
    const targetIndices = overrideIndices ?? selectedIndices;
    const targetSize = overrideSize ?? selectedSize;
    if (targetIndices.size === 0) {
      alert("Please select target cells on the grid first.");
      return;
    }
    setIsLoading(true);
    try {
      let filteredNames: string[] = [];
      const numericTarget = targetSize.replace('ml', '').trim().toLowerCase();
      if (importedItems.length > 0) {
        filteredNames = importedItems
          .filter(item => {
            if (!item.productTitle && !item.orderNumber && !item.size) return false;
            const itemSize = item.size.toLowerCase().trim();
            return itemSize === numericTarget;
          })
          .flatMap(item => Array(item.quantity || 1).fill(item.productTitle));
      } else {
        const response = await fetch(`${SHEET_URL}&cachebust=${Date.now()}`);
        const text = await response.text();
        const entries = text.split('\n').map(row => {
          const columns = row.split(',').map(c => c.replace(/"/g, '').trim());
          if (columns.length < 3) return null;
          const rawSizeText = columns[2];
          const sizeMatch = rawSizeText.match(/(\d+(\.\d+)?)/);
          const cleanSize = sizeMatch ? sizeMatch[0] : '';
          return { name: columns[1], size: cleanSize };
        }).filter((entry): entry is {name: string, size: string} => entry !== null && entry.name.length > 0);
        filteredNames = entries
          .filter(entry => entry.size === numericTarget)
          .map(entry => entry.name);
      }
      if (filteredNames.length === 0) {
        alert(`No items found for size ${targetSize}. Check your imported items.`);
        setIsLoading(false);
        return;
      }

      // Build a frequency map of names already placed in cells outside the target selection.
      // Ensures remapping a subset never duplicates items already on the grid,
      // and correctly handles multiple labels with the same name.
      const alreadyPlacedCounts: Record<string, number> = {};
      Object.entries(mappedData).forEach(([cellIdxStr, name]) => {
        const title = name as string;
        if (!targetIndices.has(Number(cellIdxStr))) {
          alreadyPlacedCounts[title] = (alreadyPlacedCounts[title] || 0) + 1;
        }
      });

      const remaining: Record<string, number> = { ...alreadyPlacedCounts };
      const availableNames = filteredNames.filter(name => {
        if ((remaining[name] || 0) > 0) {
          remaining[name]--;
          return false;
        }
        return true;
      });

      setPreviousMappedData({ ...mappedData });
      const sortedTarget = (Array.from(targetIndices) as number[]).sort((a, b) => a - b);
      const newMappings: Record<number, string> = { ...mappedData };
      sortedTarget.forEach((cellIdx: number, i: number) => {
        if (availableNames[i]) newMappings[cellIdx] = availableNames[i];
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

  const handleQuickMap = async (size: string) => {
    const config = LAYOUT_CONFIGS[layoutType as LayoutType];
    const total = config.rows * config.cols;
    const emptyCells = new Set<number>();
    for (let i = 0; i < total; i++) {
      if (!mappedData[i]) emptyCells.add(i);
    }
    if (emptyCells.size === 0) {
      alert("No empty cells to fill.");
      return;
    }
    await fetchAndMapData(emptyCells, size);
  };

  const handleToggleCell = useCallback((index: number, forceState?: boolean) => {
    setSelectedIndices((prev: Set<number>) => {
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
          ${value ? '<img src="https://i.postimg.cc/zGCwQsJh/decant-Logo.png">' : ""}
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

  const generatePerfumeList = async () => {
    if (importedItems.length === 0) {
      alert("No data imported yet.");
      return;
    }

    // Fetch prepared items from the Prepared sheet tab
    // Sheet structure: col 0 = item name, then columns labelled 1ml / 3ml / 5ml / 10ml
    // A non-empty value in a size column means that item is prepared for that size.
    const preparedMap = new Map<string, Set<string>>(); // normalised name → set of prepared sizes
    try {
      const res = await fetch(`${PREPARED_SHEET_URL}&cachebust=${Date.now()}`);
      const text = await res.text();
      const rows = text.split('\n').map(row =>
        row.split(',').map(cell => cell.replace(/"/g, '').trim())
      );

      if (rows.length > 1) {
        const header = rows[0].map(h => h.toLowerCase().replace(/\s+/g, ''));
        const sizeColMap: Record<string, number> = {};
        ['1ml', '3ml', '5ml', '10ml'].forEach(size => {
          const idx = header.indexOf(size);
          if (idx !== -1) sizeColMap[size] = idx;
        });

        rows.slice(1).forEach(cols => {
          const name = cols[0]?.toLowerCase().trim();
          if (!name) return;
          Object.entries(sizeColMap).forEach(([size, colIdx]) => {
            if (cols[colIdx]?.trim()) {
              if (!preparedMap.has(name)) preparedMap.set(name, new Set());
              preparedMap.get(name)!.add(size);
            }
          });
        });
      }
    } catch (err) {
      console.error("Failed to fetch prepared list:", err);
    }

    const isSizePrepared = (rawTitle: string, size: string): boolean => {
      const sizeNorm = size.toLowerCase().replace('ml', '').trim() + 'ml';
      const check = (name: string) => preparedMap.get(name.toLowerCase())?.has(sizeNorm) ?? false;
      return check(preprocessText(rawTitle)) || check(rawTitle);
    };

    // Group items by title; repeat size entry by quantity so counts are accurate
    const grouped = importedItems.reduce((acc, item) => {
      const title = item.productTitle?.trim();
      if (!title) return acc;
      if (!acc[title]) acc[title] = [];
      const qty = item.quantity || 1;
      for (let q = 0; q < qty; q++) acc[title].push(item.size);
      return acc;
    }, {} as Record<string, string[]>);

    // Sort titles: Brands first, then alphabetical
    const sortedTitles = Object.keys(grouped).sort((a, b) => {
      const aHasBrand = brands.some(brand => a.toLowerCase().includes(brand.toLowerCase()));
      const bHasBrand = brands.some(brand => b.toLowerCase().includes(brand.toLowerCase()));
      if (aHasBrand && !bHasBrand) return -1;
      if (!aHasBrand && bHasBrand) return 1;
      return a.localeCompare(b);
    });

    const margin = 0.25;
    const pageWidth = 4.03;

    // First pass: Calculate total height needed
    const tempDoc = new jsPDF({ unit: 'in', format: [pageWidth, 200] });
    tempDoc.setFontSize(9);
    let currentY = 1.0;

    type SizePart = { num: string; prepared: boolean };
    const displayData = sortedTitles.map((title, index) => {
      const sizeParts: SizePart[] = grouped[title].map((s: string) => ({
        num: s.toLowerCase().replace('ml', '').trim(),
        prepared: isSizePrepared(title, s),
      }));
      const anyPrepared = sizeParts.some(s => s.prepared);
      // Plain text used only for height estimation
      const plainText = `${index + 1}. ${title} (${sizeParts.map(s => s.prepared ? `${s.num}*` : s.num).join(' | ')})`;
      const lines = tempDoc.splitTextToSize(plainText, pageWidth - margin * 2);
      const itemHeight = (lines.length * 0.15) + 0.05;
      const itemY = currentY;
      currentY += itemHeight;
      return { title, sizeParts, anyPrepared, y: itemY, index };
    });

    const finalHeight = Math.max(currentY + 0.5, 2);

    const doc = new jsPDF({
      unit: 'in',
      format: [pageWidth, finalHeight]
    });

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Perfume Inventory", margin, 0.5);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, 0.65);
    doc.line(margin, 0.75, pageWidth - margin, 0.75);

    // List — inline mixed formatting
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    displayData.forEach(item => {
      let curX = margin;
      const y = item.y;

      // Index number
      doc.setFont("helvetica", "normal");
      const indexText = `${item.index + 1}. `;
      doc.text(indexText, curX, y);
      curX += doc.getTextWidth(indexText);

      // Title — underlined if any size is prepared
      doc.text(item.title, curX, y);
      if (item.anyPrepared) {
        const tw = doc.getTextWidth(item.title);
        doc.setLineWidth(0.004);
        doc.line(curX, y + 0.015, curX + tw, y + 0.015);
      }
      curX += doc.getTextWidth(item.title);

      // Opening paren
      doc.setFont("helvetica", "normal");
      doc.text(' (', curX, y);
      curX += doc.getTextWidth(' (');

      // Sizes — bold + * if prepared, normal otherwise
      item.sizeParts.forEach((part, i) => {
        if (i > 0) {
          doc.setFont("helvetica", "normal");
          doc.text(' | ', curX, y);
          curX += doc.getTextWidth(' | ');
        }
        if (part.prepared) {
          doc.setFont("helvetica", "bold");
          const sizeText = `${part.num}*`;
          doc.text(sizeText, curX, y);
          curX += doc.getTextWidth(sizeText);
        } else {
          doc.setFont("helvetica", "normal");
          doc.text(part.num, curX, y);
          curX += doc.getTextWidth(part.num);
        }
      });

      // Closing paren
      doc.setFont("helvetica", "normal");
      doc.text(')', curX, y);
    });

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  const currentConfig = LAYOUT_CONFIGS[layoutType];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f5f5f7]">
      {/* Apple Vibrant Header / Global Toolbar */}
      <header className="no-print apple-blur sticky top-0 z-50 bg-white/75 border-b border-black/5 shrink-0 flex flex-col">
        <div className="px-4 md:px-6 h-20 flex items-center">
        <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between relative">
          {/* Left: Logo */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <img src={LOGO_URL} alt="Mystic Label" className="h-7 md:h-9 w-auto object-contain" />
            <div className="hidden sm:block h-5 w-px bg-black/10 mx-1 md:mx-2" />
            <div className="hidden sm:flex flex-col">
              <h1 className="text-xs md:text-sm font-extrabold tracking-tight text-black leading-none uppercase">Mystic Label</h1>
              <span className="text-[8px] md:text-[10px] font-semibold text-gray-400 mt-0.5 md:mt-1 uppercase tracking-widest">Creative Suite</span>
            </div>
          </div>
          
          {/* Center: Tabs */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <div className="ios-segmented-control p-0.5 md:p-1 bg-black/5 rounded-xl md:rounded-2xl flex items-center">
              <button 
                onClick={() => setActiveTab('import')}
                className={`px-3 sm:px-6 md:px-10 py-1.5 md:py-2.5 text-[10px] sm:text-xs md:text-sm font-bold rounded-lg md:rounded-xl transition-all ${activeTab === 'import' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <div className="flex items-center gap-1.5 md:gap-2.5">
                  <ClipboardList size={14} className="md:w-[18px] md:h-[18px]" /> 
                  <span className="hidden xs:inline">Import Data</span>
                  <span className="xs:hidden">Import</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-3 sm:px-6 md:px-10 py-1.5 md:py-2.5 text-[10px] sm:text-xs md:text-sm font-bold rounded-lg md:rounded-xl transition-all ${activeTab === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <div className="flex items-center gap-1.5 md:gap-2.5">
                  <LayoutGrid size={14} className="md:w-[18px] md:h-[18px]" />
                  <span className="hidden xs:inline">Label Print</span>
                  <span className="xs:hidden">Print</span>
                </div>
              </button>
            </div>
          </div>

          {/* Right: Status & Settings */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {isBackgroundSyncing && (
              <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-blue-500 px-3 py-1 bg-blue-50 rounded-full animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                <span>CLOUD SYNC</span>
              </div>
            )}
            
            <div className="hidden lg:flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-full border border-black/5">
               <Zap size={12} className="text-amber-500" fill="currentColor" />
               <span className="text-[10px] font-black text-black/30">V1.1 PROMAX</span>
            </div>

            <button 
              onClick={generatePerfumeList}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-black px-3 md:px-4 py-1.5 rounded-full border border-black/10 shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider"
              title="Generate Perfume List"
            >
              <FileText size={14} className="text-blue-500" />
              <span className="hidden sm:inline">List</span>
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 md:p-2.5 bg-white hover:bg-gray-50 text-gray-400 hover:text-black rounded-full border border-black/10 shadow-sm transition-all active:scale-95"
              title="System Settings"
            >
              <Settings2 size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
          </div>
        </div>
        </div>
        {activeTab === 'import' && (
          <div className="px-4 md:px-6 h-11 flex items-center justify-center border-t border-black/5 bg-white/50">
            <div className="relative w-full max-w-sm group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 transition-colors group-focus-within:text-blue-500 pointer-events-none" size={13} />
                <input
                  type="text"
                  placeholder="Search orders, products..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-black/5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[11px] font-semibold text-gray-900 placeholder:text-gray-400"
                />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'grid' ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f5f5f7] overflow-hidden p-6">
            <div className="flex flex-row items-stretch gap-6 h-full min-h-0">
              {/* Workspace Area - Sheet View */}
              <div className="h-full shadow-xl rounded-sm overflow-hidden aspect-[8.5/11] bg-white shrink-0 relative">
                <Grid
                  config={currentConfig}
                  selectedIndices={selectedIndices}
                  onToggleCell={handleToggleCell}
                  onClearCell={handleClearCell}
                  mappedData={mappedData}
                  preprocessText={preprocessText}
                />
              </div>

              {/* Sidebar */}
              <aside className="no-print w-72 bg-white/95 apple-card rounded-[24px] flex flex-col shrink-0 shadow-xl border border-black/5 h-full">
                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                  {/* Format Layout */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Settings2 size={14} className="text-blue-500" />
                      <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Format</h3>
                    </div>
                    <div className="relative">
                      <select
                        value={layoutType}
                        onChange={(e) => setLayoutType(e.target.value as LayoutType)}
                        className="w-full bg-gray-50 border-none rounded-lg px-3 py-2.5 text-xs font-bold appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer hover:bg-gray-100"
                      >
                        <option value="standard">1ml / 3ml — Small (8×20)</option>
                        <option value="large">5ml / 10ml — Large (3×10)</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                    </div>
                  </section>

                  {/* Size Breakdown */}
                  {Object.keys(sizeCounts).length > 0 && (
                    <>
                      <div className="h-px bg-black/5" />
                      <section className="space-y-2">
                        {currentConfig.options.map(size => (
                          <div key={size} className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{size}</span>
                            <span className="text-[10px] font-black text-black bg-gray-50 px-2 py-0.5 rounded-md border border-black/5 shadow-sm">
                              {sizeCounts[size] ?? 0}
                            </span>
                          </div>
                        ))}
                      </section>
                    </>
                  )}

                  {/* Manual Map — shown only when cells are drag-selected */}
                  {selectedIndices.size > 0 && (
                    <>
                      <div className="h-px bg-black/5" />
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <MousePointer2 size={14} className="text-blue-500" />
                          <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Map {selectedIndices.size} Selected</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {currentConfig.options.map(size => (
                            <button
                              key={size}
                              onClick={() => fetchAndMapData(selectedIndices, size)}
                              disabled={isLoading}
                              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm shadow-blue-500/20"
                            >
                              {isLoading ? <Loader2 size={12} className="animate-spin" /> : size}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setSelectedIndices(new Set<number>())}
                          className="mt-2 w-full text-[9px] font-bold text-gray-400 hover:text-gray-600 py-1 transition-colors"
                        >
                          Clear Selection
                        </button>
                      </section>
                    </>
                  )}

                  <div className="h-px bg-black/5" />

                  {/* Stats */}
                  <section className="bg-gray-50 rounded-xl p-4 space-y-3 border border-black/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Mapped</span>
                      <span className="text-[10px] font-black text-black bg-white px-2 py-0.5 rounded-md border border-black/5 shadow-sm">
                        {Object.keys(mappedData).length} / {currentConfig.rows * currentConfig.cols}
                      </span>
                    </div>
                    {selectedIndices.size > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Selected</span>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{selectedIndices.size}</span>
                      </div>
                    )}
                  </section>

                  <div className="h-px bg-black/5" />

                  {/* Undo + Clear */}
                  <section className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={previousMappedData === null}
                      className={`flex items-center justify-center gap-1.5 bg-white border border-black/10 py-2.5 rounded-xl font-bold text-[10px] text-gray-600 transition-all active:scale-95 ${previousMappedData === null ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >
                      <RotateCcw size={12} />
                      Undo
                    </button>
                    <button
                      onClick={handleResetGrid}
                      className="flex items-center justify-center gap-1.5 bg-white border border-black/10 py-2.5 rounded-xl font-bold text-[10px] text-gray-600 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all active:scale-95"
                    >
                      Clear All
                    </button>
                  </section>

                </div>

                {/* Generate PDF */}
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
                searchTerm={searchTerm}
              />
            </div>
          </div>
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        brands={brands}
        wordsToRemove={wordsToRemove}
        altNameDict={altNameDict}
        onSave={saveSettings}
        isLoading={isSettingsLoading}
      />
    </div>
  );
};

export default App;
