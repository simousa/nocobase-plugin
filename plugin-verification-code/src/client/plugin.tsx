import { Plugin } from '@nocobase/client';
import models from './models';
// The captcha guard is framework-agnostic (plain DOM + isolated React roots +
// axios interceptors on app.apiClient) — safe to share with the v2 client.
import { setupCaptchaGuard } from '../client-v2/captcha-guard';
import ImageCaptchaAdminSettingsForm from './ImageCaptchaAdminSettingsForm';
// @ts-ignore
import pkg from '../../package.json';

const VERIFICATION_PLUGIN = '@nocobase/plugin-verification';
const VERIFICATION_NAME = 'verification';
const IMAGE_CAPTCHA_TYPE = 'image-captcha';

/**
 * Find the official verification plugin's `verificationManager` in a way that
 * does NOT depend on the exact plugin key it is registered under, nor on the
 * load order. Mirrors the v2 client's resolver.
 */
function resolveVerificationManager(app: any): any {
  for (const key of [VERIFICATION_PLUGIN, VERIFICATION_NAME]) {
    try {
      const p = app.pm?.get?.(key);
      if (p?.verificationManager) return p.verificationManager;
    } catch (e) {
      // ignore
    }
  }
  const candidates: any[] = [];
  const byInstances = app.pm?.pluginInstances;
  if (byInstances && typeof byInstances.values === 'function') {
    for (const inst of byInstances.values()) candidates.push(inst);
  }
  const byPlugins = app.pm?.plugins;
  if (byPlugins && typeof byPlugins.values === 'function') {
    for (const inst of byPlugins.values()) candidates.push(inst);
  }
  for (const inst of candidates) {
    if (inst?.verificationManager) return inst;
  }
  return null;
}

export class PluginVerificationCodeClient extends Plugin {
  private registered = false;
  private pollTimer: any = null;

  private doRegister(manager: any): boolean {
    if (this.registered || !manager) return this.registered;
    manager.registerVerificationType(IMAGE_CAPTCHA_TYPE, {
      title: '图片验证码',
      bindingRequired: false,
      components: {
        // Direct React component (Formily-based) — the v1 lane consumes
        // `components.AdminSettingsForm` directly, NOT a lazy loader.
        AdminSettingsForm: ImageCaptchaAdminSettingsForm,
      },
    });
    this.registered = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    return true;
  }

  private tryRegister(): boolean {
    if (this.registered) return true;
    return this.doRegister(resolveVerificationManager(this.app));
  }

  async load() {
    this.flowEngine.registerModels(models);
    // Inject image captcha on legacy (v1) auth pages: /signin, /signup,
    // /forgot-password. Same server config (captcha:getPublicConfig) as v2.
    setupCaptchaGuard(this.app, (key: string) => this.app.i18n.t(key, { ns: [pkg.name, 'client'] }) as string);

    // Register the admin settings form into the v1 verification manager so
    // the legacy /admin/settings/verification add/edit drawer shows it.
    if (this.tryRegister()) {
      return;
    }

    // The verification plugin may finish loading AFTER this user plugin.
    // Two fallbacks: listen for its `loaded` event, and poll briefly.
    const app: any = this.app;
    const onVerificationLoaded = (ev: any) => {
      const plugin = ev?.detail;
      if (plugin?.verificationManager) {
        this.doRegister(plugin.verificationManager);
      }
    };
    if (app.eventBus?.addEventListener) {
      app.eventBus.addEventListener(`plugin:${VERIFICATION_NAME}:loaded`, onVerificationLoaded);
      app.eventBus.addEventListener(`plugin:${VERIFICATION_PLUGIN}:loaded`, onVerificationLoaded);
    }

    this.pollTimer = setInterval(() => {
      if (this.tryRegister()) {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      }
    }, 500);
    setTimeout(() => {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      this.tryRegister();
    }, 60000);
  }
}

export default PluginVerificationCodeClient;
