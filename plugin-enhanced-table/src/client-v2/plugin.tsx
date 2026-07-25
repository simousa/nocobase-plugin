import { Plugin } from '@nocobase/client-v2';

export class PluginEnhancedTableClientV2 extends Plugin {
  async load() {
    this.flowEngine.registerModelLoaders({
      EnhancedTableBlockModel: {
        loader: () => import('./models/EnhancedTableBlockModel'),
      },
    });
  }
}

export default PluginEnhancedTableClientV2;
