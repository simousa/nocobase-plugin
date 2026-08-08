/**
 * Client-side cache of the *global* barcode defaults configured on the
 * plugin settings page. Field-level settings are merged on top of these.
 */
import {
  BarcodeGlobalDefaults,
  BarcodeOptions,
  BUILT_IN_GLOBAL_DEFAULTS,
  SETTINGS_RESOURCE,
} from '../../constants';
import { clearBarcodeCache } from './encoders';

let globalDefaults: BarcodeGlobalDefaults = { ...BUILT_IN_GLOBAL_DEFAULTS };
let loaded = false;

export function getGlobalDefaults(): BarcodeGlobalDefaults {
  return globalDefaults;
}

export function setGlobalDefaults(next: Partial<BarcodeGlobalDefaults> | null | undefined) {
  globalDefaults = { ...BUILT_IN_GLOBAL_DEFAULTS, ...(next || {}) };
  loaded = true;
  // Previously memoised symbols were produced with the old defaults.
  clearBarcodeCache();
}

export function isGlobalDefaultsLoaded() {
  return loaded;
}

/**
 * Fetch the global defaults once per page load. Failures are non-fatal: the
 * built-in defaults are used instead so field rendering never breaks because
 * of a settings request.
 */
export async function loadGlobalDefaults(api: any): Promise<BarcodeGlobalDefaults> {
  try {
    const res = await api.request({ url: `${SETTINGS_RESOURCE}:get`, method: 'get' });
    setGlobalDefaults(res?.data?.data);
  } catch (e) {
    setGlobalDefaults(null);
  }
  return globalDefaults;
}

export async function saveGlobalDefaults(api: any, values: Partial<BarcodeGlobalDefaults>) {
  // `simoBarcodeSettings` is a single-row settings resource whose `update`
  // action resolves the target row internally (findOne + upsert). NocoBase's
  // framework-wide `validateFilterParams` middleware still guards *every*
  // `update` action and throws "to do update action, filter or filterByTk is
  // required" unless one is supplied. We pass `forceUpdate` as a query param
  // (query string is what the resourcer merges into `ctx.action.params`, the
  // request body is folded into `values` instead) so the guard is skipped
  // while our own handler keeps doing the safe upsert.
  const res = await api.request({
    url: `${SETTINGS_RESOURCE}:update?forceUpdate=true`,
    method: 'post',
    data: values,
  });
  setGlobalDefaults(res?.data?.data ?? values);
  return globalDefaults;
}

/**
 * Merge order: built-in → global settings page → per-field flow params.
 * `undefined` / `null` entries in the field params are ignored so that a
 * field only overrides what it explicitly sets.
 */
export function resolveOptions(fieldParams?: Partial<BarcodeOptions> | null): BarcodeOptions {
  const merged: any = { enabled: false, ...globalDefaults };
  if (fieldParams) {
    for (const key of Object.keys(fieldParams)) {
      const value = (fieldParams as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        merged[key] = value;
      }
    }
    // `enabled` and the booleans must survive an explicit `false`.
    if (typeof fieldParams.enabled === 'boolean') merged.enabled = fieldParams.enabled;
    if (typeof fieldParams.displayValue === 'boolean') merged.displayValue = fieldParams.displayValue;
    if (typeof fieldParams.fallbackToText === 'boolean') merged.fallbackToText = fieldParams.fallbackToText;
    if (typeof fieldParams.clickToPreview === 'boolean') merged.clickToPreview = fieldParams.clickToPreview;
    if (typeof fieldParams.downloadable === 'boolean') merged.downloadable = fieldParams.downloadable;
  }
  return merged as BarcodeOptions;
}
