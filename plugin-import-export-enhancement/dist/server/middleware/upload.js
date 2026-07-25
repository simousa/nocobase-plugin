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
var upload_exports = {};
__export(upload_exports, {
  importEnhancedMiddleware: () => importEnhancedMiddleware
});
module.exports = __toCommonJS(upload_exports);
var import_utils = require("@nocobase/utils");
const LIMIT_FILE_SIZE_MB = 200;
const upload = (0, import_utils.koaMulter)({
  storage: import_utils.koaMulter.memoryStorage(),
  limits: { fileSize: LIMIT_FILE_SIZE_MB * 1024 * 1024 }
}).single("file");
async function importEnhancedMiddleware(ctx, next) {
  var _a;
  if (((_a = ctx.action) == null ? void 0 : _a.actionName) !== "importEnhanced") {
    return next();
  }
  if (!/multipart\/form-data/i.test(ctx.get("Content-Type") || "")) {
    return next();
  }
  await upload(ctx, async () => {
  });
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  importEnhancedMiddleware
});
