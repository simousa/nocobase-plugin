import { Plugin } from '@nocobase/server';
import { exportEnhanced } from './actions/export-enhanced';
import { importEnhanced } from './actions/import-enhanced';
import { downloadImportTemplate } from './actions/download-template';
import { importEnhancedMiddleware } from './middleware/upload';

const ACTIONS = ['exportEnhanced', 'importEnhanced', 'downloadImportTemplate'];

export class PluginImportExportEnhancementServer extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    this.app.dataSourceManager.afterAddDataSource((dataSource: any) => {
      const resourceManager = dataSource.resourceManager;
      if (!resourceManager) return;

      resourceManager.use(importEnhancedMiddleware);
      resourceManager.registerActionHandlers({
        exportEnhanced,
        importEnhanced,
        downloadImportTemplate,
      });

      dataSource.acl?.allow('*', ACTIONS, 'loggedIn');
    });
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginImportExportEnhancementServer;
