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
var export_enhanced_exports = {};
__export(export_enhanced_exports, {
  exportEnhanced: () => exportEnhanced
});
module.exports = __toCommonJS(export_enhanced_exports);
var import_xlsx = require("../utils/xlsx");
var import_repository = require("../utils/repository");
async function exportEnhanced(ctx, next) {
  const repository = (0, import_repository.getCurrentRepository)(ctx);
  const params = ctx.action.params || {};
  const values = params.values || {};
  const columns = (0, import_repository.parseMaybeJson)(values.columns ?? params.columns, []);
  if (!Array.isArray(columns) || !columns.length) {
    return ctx.throw(400, "columns is required");
  }
  const filter = (0, import_repository.parseMaybeJson)(values.filter ?? params.filter, void 0);
  const sort = values.sort ?? params.sort;
  const appends = Array.from(
    new Set(
      columns.filter((c) => typeof c.dataIndex === "string" && c.dataIndex.includes(".")).map((c) => c.dataIndex.split(".")[0])
    )
  );
  const records = await repository.find({
    filter: filter && Object.keys(filter).length ? filter : void 0,
    sort,
    appends: appends.length ? appends : void 0
  });
  const rows = (records || []).map((r) => typeof r.toJSON === "function" ? r.toJSON() : r);
  const buffer = await (0, import_xlsx.buildXlsxBuffer)(columns, rows);
  ctx.withoutDataWrapping = true;
  ctx.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename=${encodeURIComponent(ctx.action.resourceName)}.xlsx`
  });
  ctx.body = buffer;
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  exportEnhanced
});
