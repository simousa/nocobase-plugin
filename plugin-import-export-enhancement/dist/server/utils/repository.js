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
var repository_exports = {};
__export(repository_exports, {
  getCurrentRepository: () => getCurrentRepository,
  getPrimaryKey: () => getPrimaryKey,
  parseMaybeJson: () => parseMaybeJson
});
module.exports = __toCommonJS(repository_exports);
function getCurrentRepository(ctx) {
  var _a;
  if (typeof ctx.getCurrentRepository === "function") {
    return ctx.getCurrentRepository();
  }
  const db = ctx.db || ((_a = ctx.app) == null ? void 0 : _a.db);
  return db.getRepository(ctx.action.resourceName);
}
function getPrimaryKey(collection) {
  var _a;
  if (!collection) return "id";
  const ftk = collection.filterTargetKey;
  if (typeof ftk === "string" && ftk) return ftk;
  if (Array.isArray(ftk) && ftk.length === 1) return ftk[0];
  const modelPk = (_a = collection.model) == null ? void 0 : _a.primaryKeyAttribute;
  if (modelPk) return modelPk;
  return "id";
}
function parseMaybeJson(value, fallback) {
  if (value === null || value === void 0 || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getCurrentRepository,
  getPrimaryKey,
  parseMaybeJson
});
