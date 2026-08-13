/**
 * Portal (门户) identity resolution for the multi-tab plugin.
 *
 * Design notes — how portals are identified:
 *   NocoBase already has a canonical, stable way to identify a portal. The multi-portal
 *   plugin exposes each portal as a record with a unique `portalName` (and `uid`). The
 *   current portal is resolved from the URL by matching the (basename-stripped) pathname
 *   against each record's `routePath` — the same logic NocoBase itself uses internally
 *   (`getPortalNameForPathname`). We key tabs / config by `portalName`, which is:
 *     - stable across deployments and sub-paths (basename-independent),
 *     - unique per portal, so `/x/admin` and `/v/admin` are correctly TWO different
 *       portals (different `portalName` / `uid`), and
 *     - the exact key the settings page also uses, so config and runtime never desync.
 *
 *   This replaces the earlier path-segment heuristic (first two URL segments), which was
 *   fragile: it depended on the deployment basename and broke sub-path installs.
 *
 * Basename: the single, stable source is `app.router.getBasename()` — a METHOD on the
 * React Router instance (this is what NocoBase's own multi-portal plugin calls). We never
 * read the `.basename` *property* (which can be undefined on the plugin instance and throw
 * "Cannot read properties of undefined (reading 'basename')"). We keep a URL fallback so
 * resolution still works if the router isn't ready.
 */

import type { MultiTabConfig, MultiTabItem } from '../types';

/** Shape of a NocoBase multi-portal runtime record (subset we rely on). */
export type PortalRecord = {
  uid: string;
  portalName: string;
  routePath: string;
  title?: string;
  enabled?: boolean;
};

/* ------------------------------------------------------------------ *
 * App reference (for the canonical basename getter).
 * ------------------------------------------------------------------ */

let _app: any = null;

/** Hand the plugin's Application instance to this module so we can read the basename safely. */
export function setPortalApp(app: any) {
  _app = app;
}

/**
 * The deployment sub-path (e.g. "/v"), via the framework's own API.
 *
 * `app.router.getBasename()` is a method (not a property), so it can never throw
 * "reading 'basename'". We fall back to deriving the sub-path from the live URL
 * (admin shell lives at `/<basename>/admin`) for the brief window before the router
 * is wired up. Always returns a string.
 */
export function getAppBasename(): string {
  try {
    const b = _app?.router?.getBasename?.();
    if (b) return String(b).replace(/\/+$/, '');
  } catch {
    /* ignore — fall through to URL derivation */
  }
  const p = (window.location.pathname || '/').split('?')[0].split('#')[0];
  const idx = p.indexOf('/admin');
  return idx > 0 ? p.slice(0, idx) : '';
}

/* ------------------------------------------------------------------ *
 * Portal records (from multiPortals:listEnabled).
 * ------------------------------------------------------------------ */

let _records: PortalRecord[] = [];

export function setPortalRecords(records: PortalRecord[]) {
  _records = records || [];
}

export function getPortalRecords(): PortalRecord[] {
  return _records;
}

/** Dispatched when portal records finish loading, so the bar can re-resolve its key. */
export const PORTAL_RECORDS_UPDATED = 'simo:portal-records-updated';

/** Strip the app basename (deployment sub-path) from a pathname. */
function stripBasename(pathname: string, basename: string): string {
  let s = (pathname || '').split('?')[0].split('#')[0];
  const base = (basename || '').replace(/\/+$/, '');
  if (base && base !== '/' && s.startsWith(base)) s = s.slice(base.length);
  return s.replace(/\/+$/, '') || '/';
}

/**
 * Resolve the current portal's `portalName` from a pathname, mirroring NocoBase's own
 * `getPortalNameForPathname`. We match the basename-stripped pathname against each
 * record's relative `routePath`; the LONGEST matching prefix wins (most specific portal).
 * Returns '' when no record matches (single-portal app / multi-portal plugin absent) —
 * in that case callers should fall back to the app name.
 */
export function resolvePortalName(
  pathname: string,
  records: PortalRecord[] = _records,
  basename: string = getAppBasename(),
): string {
  if (!records || records.length === 0) return '';
  const path = stripBasename(pathname, basename);
  let best = '';
  let bestLen = -1;
  for (const r of records) {
    const rp = (r.routePath || '').replace(/\/+$/, '') || '/';
    const matches = path === rp || path.startsWith(rp + '/') || (rp === '/' && path.startsWith('/'));
    if (matches && rp.length > bestLen) {
      bestLen = rp.length;
      best = r.portalName;
    }
  }
  return best;
}

/**
 * Runtime portal key. Returns the resolved `portalName` (canonical, basename-independent),
 * or the app name when not inside any portal (bare main app with no multi-portal plugin).
 */
export function getPortalKey(appName = 'main'): string {
  const name = resolvePortalName(window.location.pathname || '/');
  return name || appName || 'main';
}

/**
 * Apply the per-portal (门户) default/pinned tabs from the dedicated `portal_tab` data.
 *
 * `portalTabMap` comes from the `portal_tab` column (NOT from the global `options`),
 * keyed by the resolved `portalName`. We look up the resolved `portalName`; for a smooth
 * upgrade from the older path-segment keying (which saved configs under keys like "v/erp"),
 * we also try the basename-prefixed and basename-stripped variants of the same name.
 *
 * Crucially, ONLY `defaultTabs` / `pinnedTabs` are overridden — never style, height, or
 * any other setting. This keeps portal tabs strictly an admin concern and guarantees the
 * user's browser-local personal preferences (style, behavior, …) can never be shadowed by
 * a portal entry (the bug that previously made "all personal options look like the global
 * default"). Portals without an entry fall back to the base (top-level) values.
 */
export function applyPortalOverride(
  cfg: MultiTabConfig,
  portalKey: string,
  portalTabMap: Record<string, { defaultTabs: MultiTabItem[]; pinnedTabs: MultiTabItem[] }> = {},
): MultiTabConfig {
  if (!portalTabMap || !portalKey) return cfg;
  const candidates = new Set<string>([portalKey]);
  // basename-prefixed legacy key, e.g. "erp" -> "v/erp"
  const base = getAppBasename();
  if (base && base !== '/') {
    const prefixed = `${base.replace(/^\//, '')}/${portalKey}`.replace(/\/+/g, '/');
    candidates.add(prefixed);
  }
  // basename-stripped legacy key, e.g. "v/erp" -> "erp"
  if (portalKey.includes('/')) {
    const stripped = portalKey.split('/').filter(Boolean).slice(1).join('/');
    if (stripped) candidates.add(stripped);
  }
  for (const k of candidates) {
    const entry = portalTabMap[k];
    if (entry) {
      return {
        ...cfg,
        defaultTabs: entry.defaultTabs || [],
        pinnedTabs: entry.pinnedTabs || [],
      };
    }
  }
  return cfg;
}
