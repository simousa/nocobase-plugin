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
var download_template_exports = {};
__export(download_template_exports, {
  downloadImportTemplate: () => downloadImportTemplate
});
module.exports = __toCommonJS(download_template_exports);
var import_xlsx = require("../utils/xlsx");
var import_repository = require("../utils/repository");
async function downloadImportTemplate(ctx, next) {
  const params = ctx.action.params || {};
  const values = params.values || {};
  const columns = (0, import_repository.parseMaybeJson)(values.columns ?? params.columns, []);
  if (!Array.isArray(columns) || !columns.length) {
    return ctx.throw(400, "columns is required");
  }
  const buffer = await (0, import_xlsx.buildXlsxBuffer)(columns, []);
  ctx.withoutDataWrapping = true;
  ctx.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename=${encodeURIComponent(ctx.action.resourceName)}-template.xlsx`
  });
  ctx.body = buffer;
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  downloadImportTemplate
});
