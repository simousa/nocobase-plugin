import { Plugin, Application } from '@nocobase/client-v2';
import ImageCaptchaAdminSettingsForm from './components/ImageCaptchaAdminSettingsForm';
import { setupCaptchaGuard } from './captcha-guard';

const VERIFICATION_PLUGIN = '@nocobase/plugin-verification';
const VERIFICATION_NAME = 'verification';
const IMAGE_CAPTCHA_TYPE = 'image-captcha';

/**
 * Find the official verification plugin's `verificationManager`, in a way that
 * does NOT depend on the exact plugin key it is registered under, nor on the
 * load order. We look it up by:
 *   1. the two well-known keys (package name / short name), then
 *   2. iterating every loaded plugin instance and picking the one that owns a
 *      `verificationManager` (the verification plugin is the only one).
 */
function resolveVerificationManager(app: any): any {
  // 1) known keys
  for (const key of [VERIFICATION_PLUGIN, VERIFICATION_NAME]) {
    try {
      const p = app.pm?.get?.(key);
      if (p?.verificationManager) return p.verificationManager;
    } catch (e) {
      // ignore
    }
  }
  // 2) iterate all plugin instances (key-agnostic, order-agnostic)
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
    if (inst?.verificationManager) return inst.verificationManager;
  }
  return null;
}

export class PluginVerificationCodeClientV2 extends Plugin<any, Application> {
  private registered = false;
  private pollTimer: any = null;

  private doRegister(manager: any): boolean {
    if (this.registered || !manager) return this.registered;
    manager.registerVerificationType(IMAGE_CAPTCHA_TYPE, {
      title: this.t('Image captcha'),
      bindingRequired: false,
      components: {
        // Statically bundled (no separate lazy chunk) so the form is always
        // present once this plugin's client code is loaded by the app shell.
        AdminSettingsFormLoader: () => Promise.resolve({ default: ImageCaptchaAdminSettingsForm }),
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
    // 1) Immediate attempt — works when the verification plugin is already
    //    present in the client plugin manager (the common case, since all
    //    plugins are added to `pm` before any `load()` runs).
    if (this.tryRegister()) {
      setupCaptchaGuard(this.app, (key: string) => this.t(key) as unknown as string);
      return;
    }

    // 2) The verification plugin may finish loading AFTER this user plugin
    //    (e.g. a built-in/remote plugin resolved later). Two fallbacks:
    //    (a) listen for its `loaded` event and register into the EXACT
    //        manager instance carried in the event payload, and
    //    (b) poll the plugin manager for a while (key- and order-agnostic).

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

    // Poll up to ~60s; covers slow / late resolution of the verification
    // plugin. Resolves as soon as the manager appears.
    this.pollTimer = setInterval(() => {
      if (this.tryRegister()) {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      }
    }, 500);
    // Hard stop so we never leak the timer.
    setTimeout(() => {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      this.tryRegister();
    }, 60000);

    setupCaptchaGuard(this.app, (key: string) => this.t(key) as unknown as string);
  }
}

export default PluginVerificationCodeClientV2;
