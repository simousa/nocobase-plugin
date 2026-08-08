import { Application, Plugin } from '@nocobase/client-v2';
import { SETTINGS_PAGE_KEY } from '../constants';
import { loadGlobalDefaults } from './barcode/defaults';
import { installBarcodeDisplay } from './flows/barcodeDisplayFlow';
import BarcodeColorInput from './components/BarcodeColorInput';

export class PluginFieldBarcodeClientV2 extends Plugin<any, Application> {
  async load() {
    // 1) Colour picker used by the field-level settings dialog
    //    (`x-component: 'BarcodeColorInput'`). The built-in flow-settings
    //    component set has no colour input.
    //    NB: we register the component directly (not via `registerComponentLoaders`).
    //    `registerComponentLoaders` only accepts values whose `typeof` is
    //    `'function'`, but `connect()` from `@formily/react` returns a
    //    `forwardRef`/`memo` *object*, which would make the loader throw
    //    "component loader for 'BarcodeColorInput' must resolve to a React
    //    component or a module exporting it". Registering directly sidesteps
    //    that check — the component is stored as-is and resolves fine.
    this.flowEngine.flowSettings.registerComponents({
      BarcodeColorInput,
    });

    // 2) Inject the "Display as barcode" switch into every display field and
    //    intercept their rendering. Statically imported on purpose: the patch
    //    has to be in place before the first field renders.
    installBarcodeDisplay();

    // 3) Warm the global defaults cache. Failures are swallowed inside
    //    `loadGlobalDefaults`, so a missing/forbidden endpoint never blocks
    //    the app from booting.
    const api = (this.app as any).apiClient ?? (this.flowEngine as any)?.context?.api;
    if (api) {
      void loadGlobalDefaults(api);
    }

    // 4) Global defaults settings page.
    this.pluginSettingsManager.addMenuItem({
      key: SETTINGS_PAGE_KEY,
      title: this.t('Barcode display') as unknown as string,
      icon: 'BarcodeOutlined',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: SETTINGS_PAGE_KEY,
      key: 'index',
      title: this.t('Default options') as unknown as string,
      componentLoader: () => import('./pages/GlobalBarcodeSettingsPage'),
    });
  }
}

export default PluginFieldBarcodeClientV2;
