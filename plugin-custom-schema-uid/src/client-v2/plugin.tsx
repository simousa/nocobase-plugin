import { Application, Plugin } from '@nocobase/client-v2';
import { CustomSchemaUidMenuItemModel } from './custom-schema-uid/CustomSchemaUidMenuItemModel';

export class PluginCustomSchemaUidClientV2 extends Plugin<any, Application> {
  async load() {
    /**
     * Override the core menu-item model *by name*. FlowEngine's global flow
     * registry falls back to the parent class for every flow we don't re-register,
     * so our subclass keeps all other menu behaviour intact while replacing
     * `createMenuFromMeta` (to honour a custom schema uid) and the `menuCreation`
     * / `menuSettings` dialogs (to collect that id).
     *
     * Disabling the plugin simply stops this bundle from loading, so NocoBase's
     * stock auto-generated `uid()` route ids are restored with no extra cleanup.
     */
    this.flowEngine.registerModels({
      AdminLayoutMenuItemModel: CustomSchemaUidMenuItemModel,
    });
  }
}

export default PluginCustomSchemaUidClientV2;
