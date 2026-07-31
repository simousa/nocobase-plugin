import { Plugin } from '@nocobase/client-v2';

export class PluginEnhancedTableClientV2 extends Plugin {
  async load() {
    this.flowEngine.registerModelLoaders({
      EnhancedTableBlockModel: {
        loader: () => import('./models/EnhancedTableBlockModel'),
      },
    });
    // Register the per-field aggregation editor for use in flow settings uiSchema.
    this.flowEngine.flowSettings.registerComponentLoaders({
      FieldAggregationsEditor: () => import('./components/FieldAggregationsEditor'),
    });
  }
}

export default PluginEnhancedTableClientV2;
