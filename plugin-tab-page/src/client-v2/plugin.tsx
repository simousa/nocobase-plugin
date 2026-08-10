import { Application, Plugin } from '@nocobase/client-v2';
import { SETTINGS_PAGE_KEY } from '../constants';
import { loadGlobalConfig, getEffectiveSettings, subscribeSettings } from './tab-page/settings';
import { tabStore } from './tab-page/TabStore';
import { TabPageAdminLayoutModel } from './tab-page/TabPageAdminLayoutModel';

export class PluginTabPageClient extends Plugin<any, Application> {
  /**
   * Unsubscribe for the "tab mode switched off ⇒ clear stale tabs" watcher.
   * Kept on the instance so it can be torn down if the plugin is ever unloaded.
   */
  private unsubscribeEnabledWatch?: () => void;

  async load() {
    // Override the admin layout host model *by name*. The build-in plugin
    // registers `AdminLayoutModel` earlier, so this late registration wins and
    // turns the whole `/admin` shell into a tab strip. Disabling the plugin
    // simply stops this bundle from loading, restoring stock navigation.
    this.flowEngine.registerModels({ AdminLayoutModel: TabPageAdminLayoutModel });

    // Warm the server-side global defaults *before* restoring the tab list:
    // `restore()` consults `restoreTabsOnReload`, which is only known once the
    // server has answered. Awaiting here guarantees the admin's choice is
    // respected. `loadGlobalConfig` never throws (it falls back to the
    // built-in defaults on error), so this never blocks boot on failure.
    const api = (this.app as any).apiClient ?? (this.flowEngine as any)?.context?.api;
    if (api) {
      await loadGlobalConfig(api);
    }
    tabStore.restore();

    // When the tab mode is switched off at runtime (admin toggle, or a user
    // override of `enabled`), drop every tab and the persisted sessionStorage
    // payload. Otherwise re-enabling the mode would surface tabs whose pages
    // may already have been closed/navigated away from while the mode was off.
    let lastEnabled = getEffectiveSettings().enabled;
    this.unsubscribeEnabledWatch = subscribeSettings(() => {
      const next = getEffectiveSettings().enabled;
      if (lastEnabled && !next) {
        tabStore.reset();
      }
      lastEnabled = next;
    });

    // Settings page (global defaults + personal preferences).
    this.pluginSettingsManager.addMenuItem({
      key: SETTINGS_PAGE_KEY,
      title: this.t('Tab page') as unknown as string,
      icon: 'TagOutlined',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: SETTINGS_PAGE_KEY,
      key: 'index',
      title: this.t('Settings') as unknown as string,
      componentLoader: () => import('./pages/TabPageSettingsPage'),
    });
  }
}

export default PluginTabPageClient;
