import { Plugin } from '@nocobase/client';
import models from './models';

export class PluginVerificationCodeClient extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);
  }
}

export default PluginVerificationCodeClient;
