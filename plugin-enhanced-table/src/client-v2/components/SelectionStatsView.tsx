import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../locale';

export type StatKey = 'sum' | 'average' | 'max' | 'min' | 'count';

const SELECTED_CLASS = 'nb-et-cell-selected';
const NO_SELECT_CLASS = 'nb-et-no-select';

// Parse the *displayed* text of a cell into a number (Excel status-bar semantics).
// Returns null when the text is not a plain number (dates, ids with letters, empty, etc.).
function parseCellNumber(text: string): number | null {
  const raw = (text || '').trim();
  if (!raw) return null;
  // strip thousand separators, spaces, common currency symbols and percent sign
  const cleaned = raw.replace(/[,\s\u00a5\uff04$€£%]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  // reject anything that still contains non-numeric chars (letters, dates with -, etc.)
  if (!/^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return rounded.toLocaleString();
  return Number(rounded.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface SelectionState {
  left: number;
  top: number;
  count: number;
  numericCount: number;
  sum: number;
  average: number;
  max: number;
  min: number;
}

export const SelectionStatsView: React.FC<{
  enabled: boolean;
  stats: StatKey[];
  children: React.ReactNode;
}> = ({ enabled, stats, children }) => {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const getBody = (): HTMLElement | null =>
      container.querySelector('.ant-table-tbody') as HTMLElement | null;

    const getDataRows = (body: HTMLElement): HTMLElement[] =>
      Array.from(body.querySelectorAll(':scope > tr')).filter(
        (tr) =>
          tr.classList.contains('ant-table-row') &&
          !tr.classList.contains('ant-table-measure-row'),
      ) as HTMLElement[];

    const getTds = (tr: HTMLElement): HTMLElement[] =>
      Array.from(tr.children).filter((c) => (c as HTMLElement).tagName === 'TD') as HTMLElement[];

    const clearHighlight = () => {
      container
        .querySelectorAll('.' + SELECTED_CLASS)
        .forEach((el) => el.classList.remove(SELECTED_CLASS));
    };

    let dragging = false;
    let moved = false;
    let start: { rowIdx: number; colIdx: number } | null = null;

    const locate = (td: HTMLElement) => {
      const body = getBody();
      if (!body) return null;
      const tr = td.parentElement as HTMLElement;
      if (!tr) return null;
      const dataRows = getDataRows(body);
      const rowIdx = dataRows.indexOf(tr);
      const cells = getTds(tr);
      const colIdx = cells.indexOf(td);
      if (rowIdx < 0 || colIdx < 0) return null;
      return { rowIdx, colIdx, dataRows };
    };

    const applyAndCompute = (endRowIdx: number, endColIdx: number, dataRows: HTMLElement[]) => {
      if (!start) return;
      const minR = Math.min(start.rowIdx, endRowIdx);
      const maxR = Math.max(start.rowIdx, endRowIdx);
      const minC = Math.min(start.colIdx, endColIdx);
      const maxC = Math.max(start.colIdx, endColIdx);
      clearHighlight();
      const selectedTds: HTMLElement[] = [];
      for (let r = minR; r <= maxR; r++) {
        const tr = dataRows[r];
        if (!tr) continue;
        const cells = getTds(tr);
        for (let c = minC; c <= maxC; c++) {
          const td = cells[c];
          if (td) {
            td.classList.add(SELECTED_CLASS);
            selectedTds.push(td);
          }
        }
      }
      if (!selectedTds.length) {
        setSelection(null);
        return;
      }
      const nums: number[] = [];
      selectedTds.forEach((td) => {
        const n = parseCellNumber(td.textContent || '');
        if (n !== null) nums.push(n);
      });
      const rects = selectedTds.map((td) => td.getBoundingClientRect());
      const right = Math.max(...rects.map((r) => r.right));
      const top = Math.min(...rects.map((r) => r.top));
      const numericCount = nums.length;
      const sum = nums.reduce((a, b) => a + b, 0);
      setSelection({
        left: right + 8,
        top,
        count: selectedTds.length,
        numericCount,
        sum,
        average: numericCount ? sum / numericCount : 0,
        max: numericCount ? Math.max(...nums) : 0,
        min: numericCount ? Math.min(...nums) : 0,
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      const td = target.closest('td') as HTMLElement | null;
      const body = getBody();
      if (!td || !body || !body.contains(td)) return;
      // Let interactive/selection cells behave normally.
      if (
        target.closest(
          'button, a, input, textarea, .ant-checkbox-wrapper, .ant-table-selection-column, .ant-select, .edit-icon, .ant-table-row-expand-icon',
        )
      ) {
        return;
      }
      const loc = locate(td);
      if (!loc) return;
      e.preventDefault();
      dragging = true;
      moved = false;
      start = { rowIdx: loc.rowIdx, colIdx: loc.colIdx };
      clearHighlight();
      setSelection(null);
      container.classList.add(NO_SELECT_CLASS);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const target = e.target as HTMLElement;
      const td = target.closest('td') as HTMLElement | null;
      const body = getBody();
      if (!td || !body || !body.contains(td)) return;
      const loc = locate(td);
      if (!loc) return;
      moved = true;
      e.preventDefault();
      applyAndCompute(loc.rowIdx, loc.colIdx, loc.dataRows);
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      container.classList.remove(NO_SELECT_CLASS);
      if (!moved) {
        clearHighlight();
        setSelection(null);
      }
    };

    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!container.contains(target)) {
        clearHighlight();
        setSelection(null);
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousedown', onDocMouseDown, true);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousedown', onDocMouseDown, true);
      clearHighlight();
    };
  }, [enabled]);

  const labelMap: Record<StatKey, string> = {
    sum: t('Sum'),
    average: t('Average'),
    max: t('Max'),
    min: t('Min'),
    count: t('Count'),
  };

  const popup = useMemo(() => {
    if (!enabled || !selection) return null;
    const items: { key: string; label: string; value: string }[] = [];
    const order: StatKey[] = ['sum', 'average', 'max', 'min', 'count'];
    const enabledStats = order.filter((s) => stats.includes(s));
    enabledStats.forEach((s) => {
      if (s === 'count') {
        items.push({ key: s, label: labelMap.count, value: formatNum(selection.numericCount) });
      } else if (selection.numericCount > 0) {
        items.push({ key: s, label: labelMap[s], value: formatNum((selection as any)[s]) });
      }
    });
    if (!items.length) {
      items.push({
        key: 'empty',
        label: t('Selected cells'),
        value: formatNum(selection.count),
      });
    }
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: Math.min(selection.left, window.innerWidth - 200),
          top: Math.max(8, Math.min(selection.top, window.innerHeight - 40)),
          zIndex: 2000,
          background: 'rgba(0,0,0,0.82)',
          color: '#fff',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          lineHeight: 1.7,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
          maxWidth: 220,
        }}
      >
        {items.map((it) => (
          <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ opacity: 0.75 }}>{it.label}</span>
            <span style={{ fontWeight: 600 }}>{it.value}</span>
          </div>
        ))}
      </div>,
      document.body,
    );
  }, [enabled, selection, stats, t]);

  return (
    <div ref={containerRef} className="nb-enhanced-table-container">
      <style>{`
        .nb-enhanced-table-container.${NO_SELECT_CLASS},
        .nb-enhanced-table-container.${NO_SELECT_CLASS} * {
          user-select: none !important;
        }
        .nb-enhanced-table-container .ant-table-tbody > tr > td.${SELECTED_CLASS} {
          background-color: rgba(24, 144, 255, 0.16) !important;
          box-shadow: inset 0 0 0 1px rgba(24, 144, 255, 0.55) !important;
        }
      `}</style>
      {children}
      {popup}
    </div>
  );
};

export default SelectionStatsView;
