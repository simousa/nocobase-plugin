import { Plugin } from '@nocobase/client';
import models from './models';
import { ExportEnhancedAction } from './components/ExportEnhancedAction';
import { ImportEnhancedAction } from './components/ImportEnhancedAction';
import { ExportEnhancedActionInitializer, ImportEnhancedActionInitializer } from './initializers';
import { exportEnhancedActionSettings, importEnhancedActionSettings } from './settings';
// @ts-ignore
import pkg from '../../package.json';

export class PluginImportExportEnhancementClient extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);

    this.app.addComponents({
      ExportEnhancedAction,
      ImportEnhancedAction,
      ExportEnhancedActionInitializer,
      ImportEnhancedActionInitializer,
    });

    this.app.schemaSettingsManager.add(exportEnhancedActionSettings);
    this.app.schemaSettingsManager.add(importEnhancedActionSettings);

    const exportItem = {
      type: 'item',
      title: `{{t("Export (Enhanced)", { ns: "${pkg.name}" })}}`,
      Component: 'ExportEnhancedActionInitializer',
    };
    const importItem = {
      type: 'item',
      title: `{{t("Import (Enhanced)", { ns: "${pkg.name}" })}}`,
      Component: 'ImportEnhancedActionInitializer',
    };

    this.app.schemaInitializerManager.addItem('table:configureActions', 'enableActions.exportEnhanced', exportItem);
    this.app.schemaInitializerManager.addItem('table:configureActions', 'enableActions.importEnhanced', importItem);
  }
}

export default PluginImportExportEnhancementClient;
