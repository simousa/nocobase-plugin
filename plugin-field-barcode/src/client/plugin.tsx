import { Plugin } from '@nocobase/client';
import { SETTINGS_PAGE_KEY } from '../constants';
// Shared behaviour (defaults cache, the global settings page, the colour
// picker, and the v2 flow) lives in `../client-v2/`. The v1 client does NOT use
// the FlowModel system, so its "Display as barcode" switch + read-pretty
// interception are handled by a separate, v1-specific module.
import { loadGlobalDefaults } from '../client-v2/barcode/defaults';
import { installBarcodeDisplayV1 } from '../client-v2/flows/barcodeV1Display';
import BarcodeColorInput from '../client-v2/components/BarcodeColorInput';

export class PluginFieldBarcodeClient extends Plugin {
  async load() {
    // Colour picker used by the field-level settings dialog.
    // Registered directly (not via `registerComponentLoaders`) because
    // `connect()` returns a forwardRef/memo object, which the loader path
    // rejects with a "must resolve to a React component" error.
    this.flowEngine.flowSettings.registerComponents({
      BarcodeColorInput,
    });

    // v1 display-as-barcode: registers the settings switch + modal and wraps
    // the read-pretty of the common field components.
    installBarcodeDisplayV1(this.app);

    const api = (this.app as any).apiClient ?? (this.flowEngine as any)?.context?.api;
    if (api) {
      void loadGlobalDefaults(api);
    }

    // v1 uses the legacy dotted-key settings protocol.
    this.pluginSettingsManager.add(SETTINGS_PAGE_KEY, {
      title: this.t('Barcode display') as unknown as string,
      icon: 'BarcodeOutlined',
      componentLoader: () => import('../client-v2/pages/GlobalBarcodeSettingsPage'),
    });
  }
}

export default PluginFieldBarcodeClient;
