/**
 * Barcode / QR rendering helpers.
 *
 * IMPORTANT: everything here runs **entirely in the browser**. No network
 * request of any kind is performed — `jsbarcode` and `qrcode-generator` are
 * pure-JS, dependency-free libraries that get bundled into this plugin's
 * client chunk at build time.
 */
import JsBarcode from 'jsbarcode';
import qrcode from 'qrcode-generator';
import { BarcodeOptions, isQrFormat } from '../../constants';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface BarcodeRenderResult {
  /** `false` when the value cannot be encoded with the selected symbology. */
  ok: boolean;
  /** Serialised `<svg>…</svg>` markup, empty when `ok === false`. */
  svg: string;
  width: number;
  height: number;
  /** Human readable reason, only present when `ok === false`. */
  error?: string;
}

const FAILED = (error: string): BarcodeRenderResult => ({ ok: false, svg: '', width: 0, height: 0, error });

/* ------------------------------------------------------------------ */
/* QR                                                                  */
/* ------------------------------------------------------------------ */

let utf8Patched = false;

/**
 * `qrcode-generator` defaults to a Latin-1 `stringToBytes`, which mangles
 * CJK / emoji payloads. Switching to the bundled UTF-8 implementation makes
 * Chinese content encode correctly.
 */
function ensureUtf8() {
  if (utf8Patched) return;
  const funcs = (qrcode as any).stringToBytesFuncs;
  if (funcs && funcs['UTF-8']) {
    (qrcode as any).stringToBytes = funcs['UTF-8'];
  }
  utf8Patched = true;
}

function renderQr(value: string, options: BarcodeOptions): BarcodeRenderResult {
  ensureUtf8();
  const cellSize = Math.max(1, Number(options.qrCellSize) || 3);
  const margin = Math.max(0, Number(options.margin) || 0);

  let qr: ReturnType<typeof qrcode>;
  try {
    // typeNumber `0` lets the library pick the smallest version that fits.
    qr = qrcode(0, options.qrErrorLevel || 'M');
    qr.addData(value);
    qr.make();
  } catch (e: any) {
    return FAILED(e?.message || 'QR encoding failed');
  }

  const count = qr.getModuleCount();
  const size = count * cellSize + margin * 2;

  // A single <path> keeps the markup tiny even for dense codes.
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        d += `M${margin + col * cellSize},${margin + row * cellSize}h${cellSize}v${cellSize}h-${cellSize}z`;
      }
    }
  }

  const bg =
    options.background && options.background !== 'transparent'
      ? `<rect width="${size}" height="${size}" fill="${options.background}"/>`
      : '';

  const svg =
    `<svg xmlns="${SVG_NS}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges">${bg}<path d="${d}" fill="${options.lineColor || '#000000'}"/></svg>`;

  return { ok: true, svg, width: size, height: size };
}

/* ------------------------------------------------------------------ */
/* 1D                                                                  */
/* ------------------------------------------------------------------ */

function render1d(value: string, options: BarcodeOptions): BarcodeRenderResult {
  if (typeof document === 'undefined') {
    return FAILED('DOM is not available');
  }
  // A detached element: JsBarcode only writes attributes / children onto it,
  // it never measures layout, so it does not need to be in the document.
  const el = document.createElementNS(SVG_NS, 'svg');
  let valid = true;
  let message = '';

  try {
    JsBarcode(el as any, value, {
      format: options.format,
      width: Math.max(1, Number(options.barWidth) || 2),
      height: Math.max(1, Number(options.barHeight) || 40),
      displayValue: !!options.displayValue,
      fontSize: Math.max(1, Number(options.fontSize) || 14),
      textMargin: Math.max(0, Number(options.textMargin) || 0),
      margin: Math.max(0, Number(options.margin) || 0),
      lineColor: options.lineColor || '#000000',
      background: options.background || 'transparent',
      // Swallow JsBarcode's own console noise and capture the verdict instead.
      valid: (isValid: boolean) => {
        valid = isValid;
      },
    } as any);
  } catch (e: any) {
    valid = false;
    message = e?.message || '';
  }

  if (!valid) {
    return FAILED(message || `"${value}" is not a valid ${options.format} value`);
  }

  // JsBarcode writes the size as e.g. `width="376px"` (with a unit suffix),
  // so `Number(...)` returns `NaN`. `parseFloat` strips the unit and yields
  // the numeric pixel value — without it every 1-D symbol reports an
  // "empty result" (see Bug #1).
  const width = parseFloat(el.getAttribute('width')) || 0;
  const height = parseFloat(el.getAttribute('height')) || 0;
  if (!width || !height) {
    return FAILED(message || 'Barcode rendering produced an empty result');
  }

  // `outerHTML` is not implemented for SVG elements in every engine, so fall
  // back to XMLSerializer, which is available in all supported browsers.
  const svg = (el as any).outerHTML || new XMLSerializer().serializeToString(el);
  return { ok: true, svg, width, height };
}

/* ------------------------------------------------------------------ */
/* Public API (memoised)                                               */
/* ------------------------------------------------------------------ */

const CACHE_LIMIT = 500;
const cache = new Map<string, BarcodeRenderResult>();

function cacheKey(value: string, options: BarcodeOptions) {
  const o = options;
  return [
    o.format,
    value,
    o.barWidth,
    o.barHeight,
    o.displayValue ? 1 : 0,
    o.fontSize,
    o.textMargin,
    o.qrCellSize,
    o.qrErrorLevel,
    o.margin,
    o.lineColor,
    o.background,
  ].join('|');
}

/**
 * Encode `value` into an SVG string. Results are memoised because the same
 * cell is re-rendered on every table repaint.
 */
export function renderBarcode(value: string, options: BarcodeOptions): BarcodeRenderResult {
  if (value === null || value === undefined || value === '') {
    return FAILED('Empty value');
  }
  const text = String(value);
  const key = cacheKey(text, options);
  const hit = cache.get(key);
  if (hit) return hit;

  const result = isQrFormat(options.format) ? renderQr(text, options) : render1d(text, options);

  if (cache.size >= CACHE_LIMIT) {
    // Cheap FIFO eviction — Map preserves insertion order.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, result);
  return result;
}

/** Drop every memoised symbol. Called when the global defaults change. */
export function clearBarcodeCache() {
  cache.clear();
}

/* ------------------------------------------------------------------ */
/* Download helpers (local, no network)                                */
/* ------------------------------------------------------------------ */

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, filename.endsWith('.svg') ? filename : `${filename}.svg`);
  } finally {
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Rasterise the SVG through an offscreen canvas. `scale` upsamples the symbol
 * so the PNG stays crisp when printed.
 */
export function downloadPng(svg: string, filename: string, width: number, height: number, scale = 4): Promise<void> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context is not available');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        triggerDownload(canvas.toDataURL('image/png'), filename.endsWith('.png') ? filename : `${filename}.png`);
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterise the barcode'));
    };
    img.src = url;
  });
}
