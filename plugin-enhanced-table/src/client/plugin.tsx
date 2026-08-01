import { Plugin } from '@nocobase/client';
export class PluginEnhancedTableClient extends Plugin {
  async load() {
    this.flowEngine.registerModelLoaders({
      EnhancedTableBlockModel: {
        loader: () => import('../client-v2/models/EnhancedTableBlockModel'),
      },
    });
    
    this.flowEngine.flowSettings.registerComponentLoaders({
      FieldAggregationsEditor: () => import('../client-v2/components/FieldAggregationsEditor'),
    });
  }
}

export default PluginEnhancedTableClient;
