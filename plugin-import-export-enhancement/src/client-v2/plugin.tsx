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
    // NOTE: the enriched action menu (Edit / Linkage rules / Exportable-Importable fields /
    // Delete) is registered as SchemaSettings `actionSettings:exportEnhanced` /
    // `actionSettings:importEnhanced` in the v1 client entry (src/client/settings.ts). The v1
    // client is also loaded in the modern (/v/) UI, so the same gear menu applies to the v2
    // action models (ExportEnhancedActionModel -> actionSettings:exportEnhanced).
  }
}

export default PluginImportExportEnhancementClientV2;
