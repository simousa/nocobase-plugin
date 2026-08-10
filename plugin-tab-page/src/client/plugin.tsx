import { Plugin } from '@nocobase/client';
import { AdminLayoutModel } from '@nocobase/client-v2';
import { SETTINGS_PAGE_KEY } from '../constants';
import { loadGlobalConfig } from '../client-v2/tab-page/settings';
import { tabStore } from '../client-v2/tab-page/TabStore';
import { createTabPageAdminLayoutModel } from '../client-v2/tab-page/createTabPageAdminLayoutModel';

export class PluginTabPageClient extends Plugin {
  async load() {
    // The v1 (legacy) shell registers `AdminLayoutModelV1` — which extends the
    // v2 `AdminLayoutModel` — under the *same* layout model name. `AdminLayoutModelV1`
    // is not part of the public export surface, so we read the actually
    // registered class at runtime and build our subclass on top of it. This
    // keeps the v1-specific `render()` (legacy menu shell) intact while still
    // injecting the tab strip. If for some reason it is not registered yet we
    // fall back to the v2 base, which still works.
    const Base = (this.flowEngine.getModelClass('AdminLayoutModel') as typeof AdminLayoutModel) ?? AdminLayoutModel;
    const TabPageAdminLayoutModelV1 = createTabPageAdminLayoutModel(Base);
    this.flowEngine.registerModels({ AdminLayoutModel: TabPageAdminLayoutModelV1 });

    // Restore tabs from the previous reload and warm the global defaults.
    const api = (this.app as any).apiClient ?? (this.flowEngine as any)?.context?.api;
    tabStore.restore();
    if (api) {
      void loadGlobalConfig(api);
    }

    // Settings page via the legacy dotted-key protocol.
    this.pluginSettingsManager.add(SETTINGS_PAGE_KEY, {
      title: this.t('Tab page') as unknown as string,
      icon: 'TagOutlined',
      componentLoader: () => import('../client-v2/pages/TabPageSettingsPage'),
    });
  }
}

export default PluginTabPageClient;
