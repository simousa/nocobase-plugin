import { Plugin } from '@nocobase/server';
import { CaptchaService } from './captcha-service';
import { ImageCaptchaVerification } from './image-captcha-verification';

const NAMESPACE = '@simo/plugin-verification-code';
const VERIFICATION_PLUGIN = '@nocobase/plugin-verification';
const IMAGE_CAPTCHA_TYPE = 'image-captcha';

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
  // ---- captcha image generation (controls the SVG output) ----
  width: 150,
  height: 50,
  fontSize: 50,
  // ---- page layout (controls how the box looks on screen) ----
  // layoutAuto: when true, the display box matches the captcha image's
  //   original size (zero scaling) and the input box takes the remaining
  //   width. When false, the input/display widths split by `inputRatio`.
  // inputRatio: input box width as a percentage of the container (10-99);
  //   the display box gets the rest. Only used when layoutAuto is false.
  // inputHeight / displayHeight: independent pixel heights.
  layoutAuto: true,
  inputRatio: 60,
  inputHeight: 40,
  displayHeight: 44,
  expiresIn: 300,
  rateLimitPerMinute: 30,
};

// Legacy field names (pre-0.1.0) that map onto the new page-layout model.
// Old verifiers may still store these in `options`; we migrate them on read.
const LEGACY_LAYOUT_KEYS = [
  'inputAuto',
  'inputWidth',
  'inputHeight',
  'displayAuto',
  'displayWidth',
  'displayHeight',
] as const;

function clampInt(v: any, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Convert legacy box-sizing fields into the new page-layout model.
 * - If `layoutAuto` is already set on `opts`, the new model is in use — return as-is.
 * - Otherwise derive from the old fields so existing verifiers keep working.
 */
function migrateLayout(opts: Record<string, any>): Record<string, any> {
  if (opts.layoutAuto !== undefined) return opts;
  const hasLegacy = LEGACY_LAYOUT_KEYS.some((k) => opts[k] !== undefined);
  if (!hasLegacy) return opts;
  const inputAuto = opts.inputAuto !== false;
  const displayAuto = opts.displayAuto !== false;
  const inputWidth = clampInt(opts.inputWidth, 40, 800, 220);
  const displayWidth = clampInt(opts.displayWidth, 30, 800, 120);
  const ratio = clampInt(Math.round((inputWidth / (inputWidth + displayWidth)) * 100), 10, 90, 60);
  return {
    ...opts,
    layoutAuto: inputAuto && displayAuto,
    inputRatio: ratio,
    inputHeight: clampInt(opts.inputHeight, 20, 200, 40),
    displayHeight: clampInt(opts.displayHeight, 30, 300, 44),
  };
}

/**
 * Actions protected by captcha verification.
 * scene — the boolean switch stored in the verifier's `options`.
 */
const PROTECTED_ACTIONS: Array<{ scene: string; resource: string; action: string }> = [
  { scene: 'enableSignIn', resource: 'auth', action: 'signIn' },
  { scene: 'enableSignUp', resource: 'auth', action: 'signUp' },
  { scene: 'enableLostPassword', resource: 'auth', action: 'lostPassword' },
];

// Public-form submissions are rewritten by `@nocobase/plugin-public-forms`
// (its `parseToken` middleware sets `ctx.action.actionName = 'create'` and
// `ctx.skipAuthCheck = true`). So we cannot match them by resource/action —
// we detect them by URL (the path always contains `publicSubmit`, e.g.
// `/api/users:publicSubmit`).
const PUBLIC_SUBMIT_URL = /publicSubmit/;

export class PluginVerificationCodeServer extends Plugin {
  service: CaptchaService;
  private configCache: Record<string, any> | null = null;

  async beforeLoad() {
    // Invalidate the merged config cache whenever a verifier changes.
    const invalidate = () => {
      this.configCache = null;
    };
    this.db.on('verifiers.afterSave', invalidate);
    this.db.on('verifiers.afterDestroy', invalidate);
  }

  /**
   * Resolve the effective image-captcha configuration from enabled
   * `image-captcha` verifiers. Multiple verifiers are merged: each protection
   * scene is enabled if ANY verifier turns it on, and the first verifier's
   * appearance settings win.
   */
  async getImageCaptchaConfig(): Promise<Record<string, any>> {
    if (this.configCache) {
      return this.configCache;
    }
    let rows: any[] = [];
    try {
      const repo = this.db.getRepository('verifiers');
      if (repo) {
        rows = await repo.find({ filter: { verificationType: IMAGE_CAPTCHA_TYPE } });
      }
    } catch (err) {
      this.app.logger.warn(`[verification-code] failed to read verifiers: ${err}`);
    }

    const config: Record<string, any> = { ...DEFAULT_SETTINGS };
    let appearance: Record<string, any> | null = null;
    for (const row of rows) {
      const opts = row.options && typeof row.options === 'object' ? row.options : {};
      if (!appearance) appearance = opts;
      config.enableSignIn = config.enableSignIn || !!opts.enableSignIn;
      config.enableSignUp = config.enableSignUp || !!opts.enableSignUp;
      config.enableLostPassword = config.enableLostPassword || !!opts.enableLostPassword;
      config.enablePublicForms = config.enablePublicForms || !!opts.enablePublicForms;
    }
    if (appearance) {
      const migrated = migrateLayout(appearance);
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (key.startsWith('enable')) continue; // scene switches already merged
        if (migrated[key] !== undefined) config[key] = migrated[key];
      }
    }
    this.configCache = config;
    return this.configCache;
  }

  async load() {
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

    // ---------- Register the verification type in the official plugin ----------
    let verificationPlugin: any = null;
    for (const candidate of [VERIFICATION_PLUGIN, 'verification']) {
      try {
        const p = this.app.pm.get(candidate);
        if (p?.verificationManager) {
          verificationPlugin = p;
          break;
        }
      } catch (e) {
        // plugin not present under this key — try the next
      }
    }
    if (verificationPlugin?.verificationManager) {
      verificationPlugin.verificationManager.registerVerificationType(IMAGE_CAPTCHA_TYPE, {
        title: '图片验证码',
        bindingRequired: false,
        verification: ImageCaptchaVerification,
      });
    } else {
      this.app.logger.warn(
        `[verification-code] ${VERIFICATION_PLUGIN} not found — image captcha type not registered.`,
      );
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
          const settings = await this.getImageCaptchaConfig();
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
          const settings = await this.getImageCaptchaConfig();
          // Normalize the image dimensions so the client gets safe, clamped
          // values to size the display box in auto-fit mode.
          const img = this.service.normalize(settings);
          ctx.body = {
            signIn: !!settings.enableSignIn,
            signUp: !!settings.enableSignUp,
            lostPassword: !!settings.enableLostPassword,
            publicForms: !!settings.enablePublicForms,
            box: {
              layoutAuto: settings.layoutAuto !== false,
              inputRatio: clampInt(settings.inputRatio, 10, 90, 60),
              inputHeight: clampInt(settings.inputHeight, 20, 200, 40),
              displayHeight: clampInt(settings.displayHeight, 30, 300, 44),
              imageWidth: img.width,
              imageHeight: img.height,
            },
          };
          await next();
        },
        /**
         * Admin-only live preview: render with given params, nothing stored.
         */
        test: async (ctx, next) => {
          let values: any = {};
          if (ctx.action?.params?.values) values = ctx.action.params.values;
          else if (ctx.action?.params && typeof ctx.action.params === 'object') values = ctx.action.params;
          else if (ctx.request?.body) values = ctx.request.body;
          const settings = { ...DEFAULT_SETTINGS, ...(values || {}) };
          const { svg } = this.service.render(settings);
          ctx.body = {
            image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
            engine: this.service.usingSvgCaptcha ? 'svg-captcha' : 'built-in',
          };
          await next();
        },
      },
    });

    // ---------- ACL ----------
    // The actual verifier management is governed by the verification plugin's
    // own `pm.verification` snippet. The captcha generation endpoints must be
    // public so the client guard / widgets can fetch challenges.
    this.app.acl.allow('captcha', ['generate', 'getPublicConfig'], 'public');

    // ---------- verification middleware ----------
    this.app.resourceManager.use(
      async (ctx, next) => {
        const resourceName = ctx.action?.resourceName;
        const actionName = ctx.action?.actionName;
        // Public-form submit is rewritten to `create` by plugin-public-forms,
        // so detect it by URL instead of resource/action.
        const url = (ctx.request?.url || ctx.path || '') as string;
        const isPublicSubmit = PUBLIC_SUBMIT_URL.test(url);

        let scene: string | null = null;
        if (isPublicSubmit) {
          scene = 'enablePublicForms';
        } else {
          const rule = PROTECTED_ACTIONS.find((r) => r.resource === resourceName && r.action === actionName);
          scene = rule?.scene || null;
        }
        if (!scene) {
          return next();
        }
        const settings = await this.getImageCaptchaConfig();
        if (!settings[scene]) {
          return next();
        }

        const values = ctx.action?.params?.values;
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
    // No single-row settings table anymore — configuration lives in the
    // `verifiers` collection as `image-captcha` type rows.
  }

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginVerificationCodeServer;
