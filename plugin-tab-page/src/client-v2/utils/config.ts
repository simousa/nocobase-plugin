import type { MultiTabConfig, MultiTabItem, BarPosition } from '../types';
import { DEFAULT_CONFIG } from '../types';

const PERSONAL_BASE = 'simo.multi-tabs.personal';
const OPEN_TABS_BASE = 'simo.multi-tabs.openTabs';
const ACTIVE_BASE = 'simo.multi-tabs.active';

/**
 * Current portal key (see utils/portal.ts). Tabs, active path, and personal prefs
 * are each namespaced by this key so different portals never share / bleed into one
 * another (req #2): switching a portal reloads exactly that portal's tabs. Set by the
 * bar (and the personal page) via setPortalKey() before any storage read/write.
 */
let _portalKey = '';

export function setPortalKey(key: string) {
  _portalKey = key || '';
}

export function getPortalKeySuffix(): string {
  return _portalKey ? `.${_portalKey}` : '';
}

/**
 * Latest merged bar position, shared between the isolated React root (which loads
 * the config) and the DOM mounter (which needs it to pick the anchor). Updated by
 * MultiTabsBar on every config load; read by dom.ts via getBarPosition().
 */
let _barPosition: BarPosition = DEFAULT_CONFIG.barPosition;

export function getBarPosition(): BarPosition {
  return _barPosition;
}

export function setBarPosition(p: BarPosition) {
  _barPosition = p;
  // Let the DOM mounter reposition the bar (separate event so we don't re-trigger
  // the config reload loop).
  window.dispatchEvent(new CustomEvent('simo:bar-position-changed'));
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* ---------- Personal preferences (browser localStorage, portal-scoped) ---------- */

export function loadPersonalConfig(): Partial<MultiTabConfig> {
  // Try the current portal-scoped key first, then fall back to a personal config saved
  // under a different portal key (e.g. the app-name 'main' fallback, or an older key from
  // before portalName resolution stabilized). This prevents a portal-key change from
  // silently orphaning the user's browser-local preferences and making them fall back to
  // the global default. Saving still writes to the current key (see savePersonalConfig).
  const suffix = getPortalKeySuffix();
  const candidates = [PERSONAL_BASE + suffix];
  if (suffix) candidates.push(PERSONAL_BASE);
  if (suffix !== '.main') candidates.push(PERSONAL_BASE + '.main');
  for (const key of candidates) {
    const raw = localStorage.getItem(key);
    if (raw) return safeParse<Partial<MultiTabConfig>>(raw, {});
  }
  return {};
}

export function savePersonalConfig(cfg: Partial<MultiTabConfig>) {
  localStorage.setItem(PERSONAL_BASE + getPortalKeySuffix(), JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent('simo:config-changed'));
}

export function clearPersonalConfig() {
  localStorage.removeItem(PERSONAL_BASE + getPortalKeySuffix());
  window.dispatchEvent(new CustomEvent('simo:config-changed'));
}

/* ---------- Live open tabs (browser localStorage, portal-scoped) ---------- */

export function loadOpenTabs(): MultiTabItem[] {
  return safeParse<MultiTabItem[]>(localStorage.getItem(OPEN_TABS_BASE + getPortalKeySuffix()), []);
}

export function saveOpenTabs(tabs: MultiTabItem[]) {
  localStorage.setItem(OPEN_TABS_BASE + getPortalKeySuffix(), JSON.stringify(tabs));
}

export function loadActivePath(): string | null {
  return localStorage.getItem(ACTIVE_BASE + getPortalKeySuffix());
}

export function saveActivePath(path: string) {
  localStorage.setItem(ACTIVE_BASE + getPortalKeySuffix(), path);
}

/* ---------- Merge: personal preferences > global default ---------- */

export function mergeConfig(
  global: Partial<MultiTabConfig>,
  personal: Partial<MultiTabConfig>,
): MultiTabConfig {
  const g = global || {};
  const p = personal || {};
  const out = { ...DEFAULT_CONFIG } as MultiTabConfig;
  (Object.keys(DEFAULT_CONFIG) as (keyof MultiTabConfig)[]).forEach((key) => {
    const value = p[key] ?? g[key] ?? (DEFAULT_CONFIG as any)[key];
    (out as any)[key] = value;
  });

  // Sanitize numeric ranges so the bar never receives invalid values.
  if (typeof out.maxTabs !== 'number' || out.maxTabs < 0) out.maxTabs = DEFAULT_CONFIG.maxTabs;
  if (typeof out.fixedTabWidth !== 'number' || out.fixedTabWidth < 40)
    out.fixedTabWidth = DEFAULT_CONFIG.fixedTabWidth;
  if (typeof out.minTabWidth !== 'number' || out.minTabWidth < 40)
    out.minTabWidth = DEFAULT_CONFIG.minTabWidth;
  if (typeof out.maxTabWidth !== 'number' || out.maxTabWidth < out.minTabWidth)
    out.maxTabWidth = Math.max(DEFAULT_CONFIG.maxTabWidth, out.minTabWidth);
  if (typeof out.tabHeight !== 'number' || out.tabHeight < 28)
    out.tabHeight = DEFAULT_CONFIG.tabHeight;
  if (typeof out.roundedRadius !== 'number' || out.roundedRadius < 0 || out.roundedRadius > 16)
    out.roundedRadius = DEFAULT_CONFIG.roundedRadius;

  return out;
}
