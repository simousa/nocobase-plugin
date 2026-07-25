import path from 'path';
import { Plugin } from '@nocobase/server';
import { CaptchaService } from './captcha-service';

const NAMESPACE = '@simo/plugin-verification-code';

const DEFAULT_SETTINGS = {
  enableSignIn: false,
  enableSignUp: false,
  enableLostPassword: false,
  enablePublicForms: false,
  captchaType: 'characters',
  length: 4,
  charPreset: 'alphanumeric',
  excludeSimilar: true,
  mathOperator: '+-',
  mathMin: 1,
  mathMax: 20,
  noise: 3,
  color: true,
  background: '#f2f3f5',
  width: 150,
  height: 50,
  fontSize: 50,
  expiresIn: 300,
  rateLimitPerMinute: 30,
};

/**
 * Actions protected by captcha verification.
 * scene — the boolean switch field in captchaSettings.
 */
const PROTECTED_ACTIONS: Array<{ scene: string; resource: string; action: string }> = [
  { scene: 'enableSignIn', resource: 'auth', action: 'signIn' },
  { scene: 'enableSignUp', resource: 'auth', action: 'signUp' },
  { scene: 'enableLostPassword', resource: 'auth', action: 'lostPassword' },
  { scene: 'enablePublicForms', resource: 'publicForms', action: 'publicSubmit' },
];

export class PluginVerificationCodeServer extends Plugin {
  service: CaptchaService;
  private settingsCache: Record<string, any> | null = null;

  async afterAdd() {}

  async beforeLoad() {
    // Invalidate in-memory settings cache whenever settings change
    this.db.on('captchaSettings.afterSave', () => {
      this.settingsCache = null;
    });
    this.db.on('captchaSettings.afterDestroy', () => {
      this.settingsCache = null;
    });
  }

  async getSettings(): Promise<Record<string, any>> {
    if (this.settingsCache) {
      return this.settingsCache;
    }
    let record: any = null;
    try {
      const repo = this.db.getRepository('captchaSettings');
      if (repo) {
        record = await repo.findOne({ sort: ['id'] });
      }
    } catch (err) {
      this.app.logger.warn(`[verification-code] failed to read settings: ${err}`);
    }
    this.settingsCache = { ...DEFAULT_SETTINGS, ...(record ? record.toJSON() : {}) };
    return this.settingsCache;
  }

  async load() {
    // Register the captchaSettings collection (single-row config table).
    await this.importCollections(path.resolve(__dirname, 'collections'));

    this.service = new CaptchaService(this.app.logger);

    // Use NocoBase cache manager (supports redis in multi-instance deployments);
    // the service falls back to a plain in-memory store if unavailable.
    try {
      const cache = await this.app.cacheManager.createCache({
        name: NAMESPACE,
        prefix: 'captcha',
      });
      this.service.setCache(cache as any);
    } catch (err) {
      this.app.logger.warn(`[verification-code] cacheManager unavailable, using memory store: ${err}`);
    }

    // ---------- captcha resource ----------
    this.app.resourceManager.define({
      name: 'captcha',
      actions: {
        /**
         * Generate a captcha. Public. The answer never leaves the server.
         * GET/POST /api/captcha:generate → { id, image, expiresIn }
         */
        generate: async (ctx, next) => {
          const settings = await this.getSettings();
          const ip = ctx.request.ip || 'unknown';
          if (!this.service.checkRateLimit(`gen:${ip}`, settings.rateLimitPerMinute)) {
            ctx.throw(429, ctx.t('Too many captcha requests, please try again later', { ns: NAMESPACE }));
          }
          ctx.body = await this.service.generate(settings);
          await next();
        },
        /**
         * Which scenes have captcha enabled. Public — booleans only, no config details.
         */
        getPublicConfig: async (ctx, next) => {
          const settings = await this.getSettings();
          ctx.body = {
            signIn: !!settings.enableSignIn,
            signUp: !!settings.enableSignUp,
            lostPassword: !!settings.enableLostPassword,
            publicForms: !!settings.enablePublicForms,
          };
          await next();
        },
        /**
         * Admin-only live preview: render with given params, nothing stored.
         */
        test: async (ctx, next) => {
          const values = ctx.action.params?.values || {};
          const settings = await this.getSettings();
          const { svg } = this.service.render({ ...settings, ...values });
          ctx.body = {
            image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
            engine: this.service.usingSvgCaptcha ? 'svg-captcha' : 'built-in',
          };
          await next();
        },
      },
    });

    // ---------- ACL ----------
    this.app.acl.allow('captcha', ['generate', 'getPublicConfig'], 'public');
    // Settings management is granted through a permission snippet
    // (root has it by default; other roles can be granted in ACL settings)
    this.app.acl.registerSnippet({
      name: 'pm.security.captcha',
      actions: ['captchaSettings:*', 'captcha:test'],
    });

    // ---------- verification middleware ----------
    this.app.resourceManager.use(
      async (ctx, next) => {
        const resourceName = ctx.action?.resourceName;
        const actionName = ctx.action?.actionName;
        const rule = PROTECTED_ACTIONS.find((r) => r.resource === resourceName && r.action === actionName);
        if (!rule) {
          return next();
        }
        const settings = await this.getSettings();
        if (!settings[rule.scene]) {
          return next();
        }

        const values = ctx.action.params?.values;
        const id = ctx.get('x-captcha-id') || values?.captchaId;
        const code = ctx.get('x-captcha-code') || values?.captchaCode;
        // Never let captcha fields leak into stored records
        if (values && typeof values === 'object') {
          delete values.captchaId;
          delete values.captchaCode;
        }

        if (!id || !code) {
          ctx.throw(400, ctx.t('Please complete the captcha verification', { ns: NAMESPACE }), {
            code: 'CAPTCHA_REQUIRED',
          });
        }
        const result = await this.service.verify(String(id), String(code));
        if (!result.ok) {
          const message =
            result.reason === 'expired'
              ? ctx.t('The captcha has expired, please refresh it and try again', { ns: NAMESPACE })
              : ctx.t('Incorrect captcha, please try again', { ns: NAMESPACE });
          ctx.throw(400, message, { code: 'CAPTCHA_INVALID' });
        }
        await next();
      },
      { tag: 'verifyCaptcha' },
    );
  }

  async install() {
    const repo = this.db.getRepository('captchaSettings');
    const existing = await repo.findOne();
    if (!existing) {
      await repo.create({ values: {} });
    }
  }

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginVerificationCodeServer;
