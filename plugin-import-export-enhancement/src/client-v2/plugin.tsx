import { Plugin } from '@nocobase/client-v2';

export class PluginImportExportEnhancementClientV2 extends Plugin {
  async load() {
    this.flowEngine.registerModelLoaders({
      ExportEnhancedActionModel: {
        loader: () => import('./models/ExportEnhancedActionModel'),
      },
      ImportEnhancedActionModel: {
        loader: () => import('./models/ImportEnhancedActionModel'),
      },
    });
  }
}

export default PluginImportExportEnhancementClientV2;
