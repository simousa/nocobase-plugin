/**
 * Effective settings = built-in defaults  <  global (server)  <  personal
 * (localStorage, only when the administrator allows it).
 *
 * The module keeps a single process-wide cache so both the tab bar and the
 * settings page always agree, and notifies subscribers on every change.
 */
import {
  BUILT_IN_DEFAULTS,
  LOCAL_PREFS_KEY,
  SETTINGS_RESOURCE,
  TabPageGlobalConfig,
  TabPagePrefs,
  TabPageSettings,
  USER_OVERRIDABLE_KEYS,
} from '../../constants';

type Listener = () => void;

const listeners = new Set<Listener>();

let globalConfig: TabPageGlobalConfig = { ...BUILT_IN_DEFAULTS };
let localPrefs: TabPagePrefs = {};
let effective: TabPageSettings = { ...BUILT_IN_DEFAULTS };
let globalLoaded = false;

const OVERRIDABLE = new Set<string>(USER_OVERRIDABLE_KEYS as readonly string[]);

function recompute() {
  const base: any = { ...BUILT_IN_DEFAULTS, ...globalConfig };
  if (globalConfig.allowUserOverride) {
    for (const [key, value] of Object.entries(localPrefs || {})) {
      if (value !== undefined && value !== null && OVERRIDABLE.has(key)) {
        base[key] = value;
      }
    }
  }
  effective = base as TabPageSettings;
  listeners.forEach((fn) => fn());
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export function getEffectiveSettings(): TabPageSettings {
  return effective;
}

export function getGlobalConfig(): TabPageGlobalConfig {
  return globalConfig;
}

export function getLocalPrefs(): TabPagePrefs {
  return localPrefs;
}

export function isGlobalConfigLoaded() {
  return globalLoaded;
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ------------------------------------------------------------------ *
 * Personal overrides (localStorage)
 * ------------------------------------------------------------------ */

/** Read the personal overrides of this browser. Never throws. */
export function readLocalPrefs(): TabPagePrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: any = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (OVERRIDABLE.has(key)) out[key] = value;
    }
    return out as TabPagePrefs;
  } catch {
    return {};
  }
}

export function setLocalPrefs(prefs: TabPagePrefs | null | undefined) {
  localPrefs = prefs ? readSanitized(prefs) : {};
  if (typeof window !== 'undefined') {
    try {
      if (Object.keys(localPrefs).length === 0) {
        window.localStorage.removeItem(LOCAL_PREFS_KEY);
      } else {
        window.localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(localPrefs));
      }
    } catch {
      /* private mode / quota — the in-memory value still applies */
    }
  }
  recompute();
}

export function clearLocalPrefs() {
  setLocalPrefs({});
}

function readSanitized(prefs: TabPagePrefs): TabPagePrefs {
  const out: any = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (value !== undefined && value !== null && OVERRIDABLE.has(key)) out[key] = value;
  }
  return out as TabPagePrefs;
}

/* ------------------------------------------------------------------ *
 * Global settings (server)
 * ------------------------------------------------------------------ */

export function setGlobalConfig(next: Partial<TabPageGlobalConfig> | null | undefined) {
  globalConfig = { ...BUILT_IN_DEFAULTS, ...(next || {}) };
  globalLoaded = true;
  recompute();
}

/**
 * Fetch the global settings once per page load. Failures are non-fatal — the
 * built-in defaults are used instead, so a settings request can never break
 * the whole admin layout.
 */
export async function loadGlobalConfig(api: any): Promise<TabPageGlobalConfig> {
  localPrefs = readLocalPrefs();
  try {
    const res = await api.request({ url: `${SETTINGS_RESOURCE}:get`, method: 'get' });
    setGlobalConfig(res?.data?.data);
  } catch {
    setGlobalConfig(null);
  }
  return globalConfig;
}

/**
 * Persist the global settings.
 *
 * `forceUpdate` **must** travel as a query parameter: NocoBase's framework
 * level `validateFilterParams` middleware rejects any `update` action without
 * `filter` / `filterByTk` / `forceUpdate`, and only the query string is merged
 * into `ctx.action.params` (the body is folded into `values`).
 */
export async function saveGlobalConfig(api: any, values: Partial<TabPageGlobalConfig>) {
  const res = await api.request({
    url: `${SETTINGS_RESOURCE}:update?forceUpdate=true`,
    method: 'post',
    data: values,
  });
  setGlobalConfig(res?.data?.data ?? values);
  return globalConfig;
}
