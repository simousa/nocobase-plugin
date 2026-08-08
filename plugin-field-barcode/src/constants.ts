/**
 * Shared constants between the server and both client lanes (v1 / v2).
 * This file MUST NOT import anything from `@nocobase/client*` or `react`,
 * because it is bundled into the server build as well.
 */

/** Plugin package name — used as the i18n namespace and the settings key. */
export const PLUGIN_NAME = '@simo/plugin-field-barcode';

/** Key of the flow injected into every display field model. */
export const BARCODE_FLOW_KEY = 'simoBarcodeDisplay';

/** Name of the single-row collection holding the global default options. */
export const SETTINGS_COLLECTION = 'simoBarcodeConfig';

/**
 * Resource name exposed by the server for reading/writing the global defaults.
 * Deliberately different from {@link SETTINGS_COLLECTION} so that the custom
 * `get` / `update` actions do not shadow the collection's built-in CRUD.
 */
export const SETTINGS_RESOURCE = 'simoBarcodeSettings';

/** Key of the entry registered in the plugin settings manager (`/admin/settings/...`). */
export const SETTINGS_PAGE_KEY = 'barcode-display';

/** ACL snippet guarding writes to the global defaults. */
export const SETTINGS_ACL_SNIPPET = `pm.${SETTINGS_PAGE_KEY}`;

/**
 * Supported symbologies.
 * The `*` values map 1:1 onto JsBarcode `format` strings, except `QRCODE`
 * which is handled by our own QR renderer.
 */
export const BARCODE_FORMATS = [
  { value: 'CODE128', label: 'CODE128 (auto)', group: '1d' },
  { value: 'CODE128A', label: 'CODE128 A', group: '1d' },
  { value: 'CODE128B', label: 'CODE128 B', group: '1d' },
  { value: 'CODE128C', label: 'CODE128 C', group: '1d' },
  { value: 'CODE39', label: 'CODE39', group: '1d' },
  { value: 'CODE93', label: 'CODE93', group: '1d' },
  { value: 'CODE93FullASCII', label: 'CODE93 (full ASCII)', group: '1d' },
  { value: 'EAN13', label: 'EAN-13', group: '1d' },
  { value: 'EAN8', label: 'EAN-8', group: '1d' },
  { value: 'EAN5', label: 'EAN-5', group: '1d' },
  { value: 'EAN2', label: 'EAN-2', group: '1d' },
  { value: 'UPC', label: 'UPC-A', group: '1d' },
  { value: 'UPCE', label: 'UPC-E', group: '1d' },
  { value: 'ITF14', label: 'ITF-14', group: '1d' },
  { value: 'ITF', label: 'ITF', group: '1d' },
  { value: 'MSI', label: 'MSI', group: '1d' },
  { value: 'MSI10', label: 'MSI10', group: '1d' },
  { value: 'MSI11', label: 'MSI11', group: '1d' },
  { value: 'MSI1010', label: 'MSI1010', group: '1d' },
  { value: 'MSI1110', label: 'MSI1110', group: '1d' },
  { value: 'pharmacode', label: 'Pharmacode', group: '1d' },
  { value: 'codabar', label: 'Codabar', group: '1d' },
  { value: 'QRCODE', label: 'QR Code', group: '2d' },
] as const;

export type BarcodeFormat = (typeof BARCODE_FORMATS)[number]['value'];

export const ONE_D_FORMATS: string[] = BARCODE_FORMATS.filter((f) => f.group === '1d').map((f) => f.value);

export const isQrFormat = (format?: string) => format === 'QRCODE';

/** QR error-correction levels, ordered from the lowest to the highest redundancy. */
export const QR_ERROR_LEVELS = [
  { value: 'L', label: 'L (7%)' },
  { value: 'M', label: 'M (15%)' },
  { value: 'Q', label: 'Q (25%)' },
  { value: 'H', label: 'H (30%)' },
] as const;

export type QrErrorLevel = (typeof QR_ERROR_LEVELS)[number]['value'];

/** How the original text is shown next to / under the barcode. */
export type BarcodeTextMode = 'none' | 'inline' | 'below';

export interface BarcodeOptions {
  /** Master switch — when false everything falls back to the original rendering. */
  enabled: boolean;
  format: BarcodeFormat;

  /* ---- 1D (JsBarcode) ---- */
  /** Width of a single bar, in px. */
  barWidth: number;
  /** Height of the bars, in px. */
  barHeight: number;
  /** Render the human readable text underneath the bars. */
  displayValue: boolean;
  fontSize: number;
  textMargin: number;

  /* ---- QR ---- */
  /** Size of one QR module, in px. */
  qrCellSize: number;
  qrErrorLevel: QrErrorLevel;

  /* ---- shared ---- */
  /** Quiet zone around the symbol, in px. */
  margin: number;
  /** Foreground (bars / modules) colour. */
  lineColor: string;
  /** Background colour, `transparent` is allowed. */
  background: string;

  /* ---- behaviour ---- */
  /** Fall back to the plain original text when the value cannot be encoded. */
  fallbackToText: boolean;
  /** Click the barcode to open an enlarged preview. */
  clickToPreview: boolean;
  /** Offer SVG / PNG download inside the preview modal. */
  downloadable: boolean;
  /** Also show the raw original text next to the barcode. */
  originalTextMode: BarcodeTextMode;
}

/**
 * Hard-coded fallback. The global settings page overrides these, and each
 * field can then override the global defaults again.
 */
export const BUILT_IN_DEFAULTS: BarcodeOptions = {
  enabled: false,
  format: 'CODE128',
  barWidth: 2,
  barHeight: 40,
  displayValue: true,
  fontSize: 14,
  textMargin: 2,
  qrCellSize: 3,
  qrErrorLevel: 'M',
  margin: 6,
  lineColor: '#000000',
  background: '#ffffff',
  fallbackToText: true,
  clickToPreview: true,
  downloadable: true,
  originalTextMode: 'none',
};

/** Options that the global settings page is allowed to define. */
export type BarcodeGlobalDefaults = Omit<BarcodeOptions, 'enabled'>;

export const BUILT_IN_GLOBAL_DEFAULTS: BarcodeGlobalDefaults = (() => {
  const { enabled, ...rest } = BUILT_IN_DEFAULTS;
  return rest;
})();
