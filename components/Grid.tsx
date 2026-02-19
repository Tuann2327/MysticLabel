
import React, { useState, useRef, useMemo } from 'react';
import { LabelConfig } from '../types';

interface GridProps {
  config: LabelConfig;
  selectedIndices: Set<number>;
  mappedData: Record<number, string>;
  onToggleCell: (index: number, forceState?: boolean) => void;
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const Grid: React.FC<GridProps> = ({ config, selectedIndices, mappedData, onToggleCell }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [dragAction, setDragAction] = useState<'selecting' | 'deselecting'>('selecting');
  const [previewIndices, setPreviewIndices] = useState<Set<number>>(new Set());

  const totalCells = config.rows * config.cols;

  const effectiveSelected = useMemo(() => {
    const next = new Set(selectedIndices);
    if (selectionBox) {
      previewIndices.forEach(idx => {
        if (dragAction === 'selecting') next.add(idx);
        else next.delete(idx);
      });
    }
    return next;
  }, [selectedIndices, previewIndices, selectionBox, dragAction]);

  const getCellIndexFromPoint = (x: number, y: number): number | null => {
    const element = document.elementFromPoint(x, y);
    if (element && element.hasAttribute('data-grid-index')) {
      return parseInt(element.getAttribute('data-grid-index') || '-1', 10);
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialIndex = getCellIndexFromPoint(startX, startY);
    const isDeselecting = initialIndex !== null && selectedIndices.has(initialIndex);
    setDragAction(isDeselecting ? 'deselecting' : 'selecting');
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
    if (initialIndex !== null) setPreviewIndices(new Set([initialIndex]));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!selectionBox) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null);
    
    const left = Math.min(selectionBox.startX, currentX);
    const top = Math.min(selectionBox.startY, currentY);
    const right = Math.max(selectionBox.startX, currentX);
    const bottom = Math.max(selectionBox.startY, currentY);
    
    const newPreview = new Set<number>();
    const cellElements = containerRef.current?.querySelectorAll('[data-grid-index]');
    cellElements?.forEach(el => {
      const cellRect = el.getBoundingClientRect();
      const isIntersecting = !(cellRect.right < left || cellRect.left > right || cellRect.bottom < top || cellRect.top > bottom);
      if (isIntersecting) {
        const idx = parseInt(el.getAttribute('data-grid-index') || '-1', 10);
        if (idx !== -1) newPreview.add(idx);
      }
    });
    setPreviewIndices(newPreview);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!selectionBox) return;
    previewIndices.forEach(idx => onToggleCell(idx, dragAction === 'selecting'));
    setSelectionBox(null);
    setPreviewIndices(new Set());
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative w-full h-full flex justify-center items-start">
      {selectionBox && (
        <div className={`fixed pointer-events-none z-[100] border-[1.5px] rounded-sm backdrop-blur-[1px] ${dragAction === 'selecting' ? 'bg-blue-500/10 border-blue-500/60' : 'bg-red-500/10 border-red-500/60'}`}
          style={{ 
            left: Math.min(selectionBox.startX, selectionBox.currentX), 
            top: Math.min(selectionBox.startY, selectionBox.currentY), 
            width: Math.abs(selectionBox.startX - selectionBox.currentX), 
            height: Math.abs(selectionBox.startY - selectionBox.currentY) 
          }}
        />
      )}
      <div 
        ref={containerRef} 
        className="grid select-none touch-none bg-white shadow-lg border border-black/5 w-full h-full rounded-sm overflow-hidden"
        style={{ 
          gridAutoFlow: 'column',
          gridTemplateRows: `repeat(${config.rows}, 1fr)`,
          gridTemplateColumns: `repeat(${config.cols}, 1fr)`
        }}
        onPointerDown={handlePointerDown} 
        onPointerMove={handlePointerMove} 
        onPointerUp={handlePointerUp} 
        onContextMenu={(e) => e.preventDefault()}
      >
        {Array.from({ length: totalCells }).map((_, i) => {
          const isSelected = effectiveSelected.has(i);
          const mappedValue = mappedData[i];
          const hasContent = !!mappedValue;

          return (
            <div 
              key={i} 
              data-grid-index={i} 
              className={`
                relative flex flex-col items-center justify-center text-center px-1 border-[0.5px] border-black/5 overflow-hidden
                ${isSelected ? 'bg-blue-600' : hasContent ? 'bg-green-50/20' : 'bg-white'}
              `} 
            >
              {/* Slot Index */}
              <span className={`absolute top-0.5 left-1 text-[6px] font-bold pointer-events-none ${isSelected ? 'text-blue-200' : 'text-gray-300'}`}>
                {i + 1}
              </span>

              {/* Label Content */}
              {mappedValue ? (
                <div className="flex flex-col items-center gap-0.5 w-full pointer-events-none">
                  <span className={`text-[7px] font-bold uppercase truncate w-full leading-tight px-1 tracking-tight ${isSelected ? 'text-white' : 'text-black'}`}>
                    {mappedValue}
                  </span>
                  <img 
                    src="https://i.postimg.cc/K8sVw3Dw/Mystic-Logo.png" 
                    className={`h-1.5 w-auto object-contain ${isSelected ? 'brightness-[10] opacity-80' : 'opacity-30'}`} 
                    alt="Logo" 
                  />
                </div>
              ) : (
                /* Empty Slot Dot */
                !isSelected && (
                  <div className="w-0.5 h-0.5 rounded-full bg-gray-100 pointer-events-none" />
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Grid;
