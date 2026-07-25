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
var captchaSettings_exports = {};
__export(captchaSettings_exports, {
  default: () => captchaSettings_default
});
module.exports = __toCommonJS(captchaSettings_exports);
var import_database = require("@nocobase/database");
var captchaSettings_default = (0, import_database.defineCollection)({
  name: "captchaSettings",
  title: "CAPTCHA Settings",
  fields: [
    // Scenes
    { type: "boolean", name: "enableSignIn", defaultValue: false },
    { type: "boolean", name: "enableSignUp", defaultValue: false },
    { type: "boolean", name: "enableLostPassword", defaultValue: false },
    { type: "boolean", name: "enablePublicForms", defaultValue: false },
    // Captcha content
    { type: "string", name: "captchaType", defaultValue: "characters" },
    // characters | math
    { type: "integer", name: "length", defaultValue: 4 },
    // 4-8
    { type: "string", name: "charPreset", defaultValue: "alphanumeric" },
    // alphanumeric | letters | digits
    { type: "boolean", name: "excludeSimilar", defaultValue: true },
    // exclude 0oO1ilI...
    { type: "string", name: "mathOperator", defaultValue: "+-" },
    // + | - | +-
    { type: "integer", name: "mathMin", defaultValue: 1 },
    { type: "integer", name: "mathMax", defaultValue: 20 },
    // Appearance
    { type: "integer", name: "noise", defaultValue: 3 },
    // 0-10 interference lines
    { type: "boolean", name: "color", defaultValue: true },
    { type: "string", name: "background", defaultValue: "#f2f3f5" },
    { type: "integer", name: "width", defaultValue: 150 },
    { type: "integer", name: "height", defaultValue: 50 },
    { type: "integer", name: "fontSize", defaultValue: 50 },
    // Security
    { type: "integer", name: "expiresIn", defaultValue: 300 },
    // seconds
    { type: "integer", name: "rateLimitPerMinute", defaultValue: 30 }
    // per IP
  ]
});
