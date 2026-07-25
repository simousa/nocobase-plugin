import { Plugin, Application } from '@nocobase/client-v2';
import { setupCaptchaGuard } from './captcha-guard';

export class PluginVerificationCodeClientV2 extends Plugin<any, Application> {
  async load() {
    // "Security" parent menu (menuKey: 'security') is registered by the
    // NocoBase built-in plugin — we attach a "CAPTCHA" tab to it.
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'security',
      key: 'captcha',
      title: this.t('CAPTCHA'),
      aclSnippet: 'pm.security.captcha',
      componentLoader: () => import('./pages/CaptchaSettingsPage'),
    });

    // Client-side captcha guard:
    // - injects an inline captcha widget on sign-in / sign-up / forgot-password pages
    // - opens a captcha dialog when submitting public forms
    // - attaches the captcha credential to protected API requests
    setupCaptchaGuard(this.app, (key: string) => this.t(key));
  }
}

export default PluginVerificationCodeClientV2;
