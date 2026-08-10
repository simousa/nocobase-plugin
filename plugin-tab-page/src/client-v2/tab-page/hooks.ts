import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { PLUGIN_NAME, TabPageSettings } from '../../constants';
import { getEffectiveSettings, subscribeSettings } from './settings';
import { TabState, tabStore } from './TabStore';

/** Reactive view of the open tabs. */
export function useTabState(): TabState {
  return useSyncExternalStore(tabStore.subscribe, tabStore.getSnapshot, tabStore.getSnapshot);
}

/** Reactive view of the effective (global + personal) settings. */
export function useTabSettings(): TabPageSettings {
  return useSyncExternalStore(subscribeSettings, getEffectiveSettings, getEffectiveSettings);
}

/**
 * `t()` bound to this plugin's namespace.
 *
 * Uses plain `react-i18next` — which is externalised in **both** client lanes —
 * so the very same component can be rendered by the v1 and the v2 shell.
 */
export function useTabT() {
  const { t } = useTranslation([PLUGIN_NAME, 'client'], { nsMode: 'fallback' });
  return t as (key: string, options?: any) => string;
}
