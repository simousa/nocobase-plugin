/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var plugin_exports = {};
__export(plugin_exports, {
  PluginVerificationCodeServer: () => PluginVerificationCodeServer,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_server = require("@nocobase/server");
var import_captcha_service = require("./captcha-service");
var import_image_captcha_verification = require("./image-captcha-verification");
const NAMESPACE = "@simo/plugin-verification-code";
const VERIFICATION_PLUGIN = "@nocobase/plugin-verification";
const IMAGE_CAPTCHA_TYPE = "image-captcha";
const DEFAULT_SETTINGS = {
  enableSignIn: false,
  enableSignUp: false,
  enableLostPassword: false,
  enablePublicForms: false,
  captchaType: "characters",
  length: 4,
  charPreset: "alphanumeric",
  excludeSimilar: true,
  mathOperator: "+-",
  mathMin: 1,
  mathMax: 20,
  noise: 3,
  color: true,
  background: "#f2f3f5",
  width: 150,
  height: 50,
  fontSize: 50,
  expiresIn: 300,
  rateLimitPerMinute: 30
};
const PROTECTED_ACTIONS = [
  { scene: "enableSignIn", resource: "auth", action: "signIn" },
  { scene: "enableSignUp", resource: "auth", action: "signUp" },
  { scene: "enableLostPassword", resource: "auth", action: "lostPassword" }
];
const PUBLIC_SUBMIT_URL = /publicSubmit/;
class PluginVerificationCodeServer extends import_server.Plugin {
  service;
  configCache = null;
  async beforeLoad() {
    const invalidate = () => {
      this.configCache = null;
    };
    this.db.on("verifiers.afterSave", invalidate);
    this.db.on("verifiers.afterDestroy", invalidate);
  }
  /**
   * Resolve the effective image-captcha configuration from enabled
   * `image-captcha` verifiers. Multiple verifiers are merged: each protection
   * scene is enabled if ANY verifier turns it on, and the first verifier's
   * appearance settings win.
   */
  async getImageCaptchaConfig() {
    if (this.configCache) {
      return this.configCache;
    }
    let rows = [];
    try {
      const repo = this.db.getRepository("verifiers");
      if (repo) {
        rows = await repo.find({ filter: { verificationType: IMAGE_CAPTCHA_TYPE } });
      }
    } catch (err) {
      this.app.logger.warn(`[verification-code] failed to read verifiers: ${err}`);
    }
    const config = { ...DEFAULT_SETTINGS };
    let appearance = null;
    for (const row of rows) {
      const opts = row.options && typeof row.options === "object" ? row.options : {};
      if (!appearance) appearance = opts;
      config.enableSignIn = config.enableSignIn || !!opts.enableSignIn;
      config.enableSignUp = config.enableSignUp || !!opts.enableSignUp;
      config.enableLostPassword = config.enableLostPassword || !!opts.enableLostPassword;
      config.enablePublicForms = config.enablePublicForms || !!opts.enablePublicForms;
    }
    if (appearance) {
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (key.startsWith("enable")) continue;
        if (appearance[key] !== void 0) config[key] = appearance[key];
      }
    }
    this.configCache = config;
    return this.configCache;
  }
  async load() {
    this.service = new import_captcha_service.CaptchaService(this.app.logger);
    try {
      const cache = await this.app.cacheManager.createCache({
        name: NAMESPACE,
        prefix: "captcha"
      });
      this.service.setCache(cache);
    } catch (err) {
      this.app.logger.warn(`[verification-code] cacheManager unavailable, using memory store: ${err}`);
    }
    let verificationPlugin = null;
    for (const candidate of [VERIFICATION_PLUGIN, "verification"]) {
      try {
        const p = this.app.pm.get(candidate);
        if (p == null ? void 0 : p.verificationManager) {
          verificationPlugin = p;
          break;
        }
      } catch (e) {
      }
    }
    if (verificationPlugin == null ? void 0 : verificationPlugin.verificationManager) {
      verificationPlugin.verificationManager.registerVerificationType(IMAGE_CAPTCHA_TYPE, {
        title: "\u56FE\u7247\u9A8C\u8BC1\u7801",
        bindingRequired: false,
        verification: import_image_captcha_verification.ImageCaptchaVerification
      });
    } else {
      this.app.logger.warn(
        `[verification-code] ${VERIFICATION_PLUGIN} not found \u2014 image captcha type not registered.`
      );
    }
    this.app.resourceManager.define({
      name: "captcha",
      actions: {
        /**
         * Generate a captcha. Public. The answer never leaves the server.
         * GET/POST /api/captcha:generate → { id, image, expiresIn }
         */
        generate: async (ctx, next) => {
          const settings = await this.getImageCaptchaConfig();
          const ip = ctx.request.ip || "unknown";
          if (!this.service.checkRateLimit(`gen:${ip}`, settings.rateLimitPerMinute)) {
            ctx.throw(429, ctx.t("Too many captcha requests, please try again later", { ns: NAMESPACE }));
          }
          ctx.body = await this.service.generate(settings);
          await next();
        },
        /**
         * Which scenes have captcha enabled. Public — booleans only, no config details.
         */
        getPublicConfig: async (ctx, next) => {
          const settings = await this.getImageCaptchaConfig();
          ctx.body = {
            signIn: !!settings.enableSignIn,
            signUp: !!settings.enableSignUp,
            lostPassword: !!settings.enableLostPassword,
            publicForms: !!settings.enablePublicForms
          };
          await next();
        },
        /**
         * Admin-only live preview: render with given params, nothing stored.
         */
        test: async (ctx, next) => {
          var _a, _b, _c, _d;
          let values = {};
          if ((_b = (_a = ctx.action) == null ? void 0 : _a.params) == null ? void 0 : _b.values) values = ctx.action.params.values;
          else if (((_c = ctx.action) == null ? void 0 : _c.params) && typeof ctx.action.params === "object") values = ctx.action.params;
          else if ((_d = ctx.request) == null ? void 0 : _d.body) values = ctx.request.body;
          const settings = { ...DEFAULT_SETTINGS, ...values || {} };
          const { svg } = this.service.render(settings);
          ctx.body = {
            image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
            engine: this.service.usingSvgCaptcha ? "svg-captcha" : "built-in"
          };
          await next();
        }
      }
    });
    this.app.acl.allow("captcha", ["generate", "getPublicConfig"], "public");
    this.app.resourceManager.use(
      async (ctx, next) => {
        var _a, _b, _c, _d, _e;
        const resourceName = (_a = ctx.action) == null ? void 0 : _a.resourceName;
        const actionName = (_b = ctx.action) == null ? void 0 : _b.actionName;
        const url = ((_c = ctx.request) == null ? void 0 : _c.url) || ctx.path || "";
        const isPublicSubmit = PUBLIC_SUBMIT_URL.test(url);
        let scene = null;
        if (isPublicSubmit) {
          scene = "enablePublicForms";
        } else {
          const rule = PROTECTED_ACTIONS.find((r) => r.resource === resourceName && r.action === actionName);
          scene = (rule == null ? void 0 : rule.scene) || null;
        }
        if (!scene) {
          return next();
        }
        const settings = await this.getImageCaptchaConfig();
        if (!settings[scene]) {
          return next();
        }
        const values = (_e = (_d = ctx.action) == null ? void 0 : _d.params) == null ? void 0 : _e.values;
        const id = ctx.get("x-captcha-id") || (values == null ? void 0 : values.captchaId);
        const code = ctx.get("x-captcha-code") || (values == null ? void 0 : values.captchaCode);
        if (values && typeof values === "object") {
          delete values.captchaId;
          delete values.captchaCode;
        }
        if (!id || !code) {
          ctx.throw(400, ctx.t("Please complete the captcha verification", { ns: NAMESPACE }), {
            code: "CAPTCHA_REQUIRED"
          });
        }
        const result = await this.service.verify(String(id), String(code));
        if (!result.ok) {
          const message = result.reason === "expired" ? ctx.t("The captcha has expired, please refresh it and try again", { ns: NAMESPACE }) : ctx.t("Incorrect captcha, please try again", { ns: NAMESPACE });
          ctx.throw(400, message, { code: "CAPTCHA_INVALID" });
        }
        await next();
      },
      { tag: "verifyCaptcha" }
    );
  }
  async install() {
  }
  async afterEnable() {
  }
  async afterDisable() {
  }
  async remove() {
  }
}
var plugin_default = PluginVerificationCodeServer;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PluginVerificationCodeServer
});
