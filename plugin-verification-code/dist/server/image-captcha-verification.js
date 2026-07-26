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
var image_captcha_verification_exports = {};
__export(image_captcha_verification_exports, {
  ImageCaptchaVerification: () => ImageCaptchaVerification,
  default: () => image_captcha_verification_default
});
module.exports = __toCommonJS(image_captcha_verification_exports);
var import_plugin_verification = require("@nocobase/plugin-verification");
const PLUGIN_NAME = "@simo/plugin-verification-code";
class ImageCaptchaVerification extends import_plugin_verification.Verification {
  async verify({ resource, action, userId, boundInfo, verifyParams }) {
    var _a, _b, _c, _d;
    const plugin = this.ctx.app.pm.get(PLUGIN_NAME);
    const id = (verifyParams == null ? void 0 : verifyParams.captchaId) || ((_b = (_a = this.ctx).get) == null ? void 0 : _b.call(_a, "x-captcha-id"));
    const code = (verifyParams == null ? void 0 : verifyParams.captchaCode) || ((_d = (_c = this.ctx).get) == null ? void 0 : _d.call(_c, "x-captcha-code"));
    if (!id || !code) {
      return this.ctx.throw(400, this.ctx.t("Please complete the captcha verification", { ns: PLUGIN_NAME }), {
        code: "CAPTCHA_REQUIRED"
      });
    }
    const result = await plugin.service.verify(String(id), String(code));
    if (!result.ok) {
      const message = result.reason === "expired" ? this.ctx.t("The captcha has expired, please refresh it and try again", { ns: PLUGIN_NAME }) : this.ctx.t("Incorrect captcha, please try again", { ns: PLUGIN_NAME });
      return this.ctx.throw(400, message, { code: "CAPTCHA_INVALID" });
    }
    return { verified: true };
  }
}
var image_captcha_verification_default = ImageCaptchaVerification;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ImageCaptchaVerification
});
