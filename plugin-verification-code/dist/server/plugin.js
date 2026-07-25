/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var plugin_exports = {};
__export(plugin_exports, {
  PluginVerificationCodeServer: () => PluginVerificationCodeServer,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_path = __toESM(require("path"));
var import_server = require("@nocobase/server");
var import_captcha_service = require("./captcha-service");
const NAMESPACE = "@simo/plugin-verification-code";
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
  { scene: "enableLostPassword", resource: "auth", action: "lostPassword" },
  { scene: "enablePublicForms", resource: "publicForms", action: "publicSubmit" }
];
class PluginVerificationCodeServer extends import_server.Plugin {
  service;
  settingsCache = null;
  async afterAdd() {
  }
  async beforeLoad() {
    this.db.on("captchaSettings.afterSave", () => {
      this.settingsCache = null;
    });
    this.db.on("captchaSettings.afterDestroy", () => {
      this.settingsCache = null;
    });
  }
  async getSettings() {
    if (this.settingsCache) {
      return this.settingsCache;
    }
    let record = null;
    try {
      const repo = this.db.getRepository("captchaSettings");
      if (repo) {
        record = await repo.findOne({ sort: ["id"] });
      }
    } catch (err) {
      this.app.logger.warn(`[verification-code] failed to read settings: ${err}`);
    }
    this.settingsCache = { ...DEFAULT_SETTINGS, ...record ? record.toJSON() : {} };
    return this.settingsCache;
  }
  async load() {
    await this.importCollections(import_path.default.resolve(__dirname, "collections"));
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
    this.app.resourceManager.define({
      name: "captcha",
      actions: {
        /**
         * Generate a captcha. Public. The answer never leaves the server.
         * GET/POST /api/captcha:generate → { id, image, expiresIn }
         */
        generate: async (ctx, next) => {
          const settings = await this.getSettings();
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
          const settings = await this.getSettings();
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
          var _a;
          const values = ((_a = ctx.action.params) == null ? void 0 : _a.values) || {};
          const settings = await this.getSettings();
          const { svg } = this.service.render({ ...settings, ...values });
          ctx.body = {
            image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
            engine: this.service.usingSvgCaptcha ? "svg-captcha" : "built-in"
          };
          await next();
        }
      }
    });
    this.app.acl.allow("captcha", ["generate", "getPublicConfig"], "public");
    this.app.acl.registerSnippet({
      name: "pm.security.captcha",
      actions: ["captchaSettings:*", "captcha:test"]
    });
    this.app.resourceManager.use(
      async (ctx, next) => {
        var _a, _b, _c;
        const resourceName = (_a = ctx.action) == null ? void 0 : _a.resourceName;
        const actionName = (_b = ctx.action) == null ? void 0 : _b.actionName;
        const rule = PROTECTED_ACTIONS.find((r) => r.resource === resourceName && r.action === actionName);
        if (!rule) {
          return next();
        }
        const settings = await this.getSettings();
        if (!settings[rule.scene]) {
          return next();
        }
        const values = (_c = ctx.action.params) == null ? void 0 : _c.values;
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
    const repo = this.db.getRepository("captchaSettings");
    const existing = await repo.findOne();
    if (!existing) {
      await repo.create({ values: {} });
    }
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
