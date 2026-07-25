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
var import_enhanced_exports = {};
__export(import_enhanced_exports, {
  importEnhanced: () => importEnhanced
});
module.exports = __toCommonJS(import_enhanced_exports);
var import_xlsx = require("../utils/xlsx");
var import_repository = require("../utils/repository");
function coerceValue(fieldType, value) {
  if (value === null || value === void 0 || value === "") return null;
  switch (fieldType) {
    case "boolean": {
      if (typeof value === "boolean") return value;
      const s = String(value).trim().toLowerCase();
      return ["true", "1", "yes", "y", "\u662F"].includes(s);
    }
    case "integer":
    case "bigInt":
    case "float":
    case "double":
    case "decimal":
    case "real":
    case "sort": {
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case "date":
    case "datetime":
    case "datetimeTz":
    case "datetimeNoTz":
    case "dateOnly":
    case "unixTimestamp": {
      if (value instanceof Date) return value;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    case "json":
    case "jsonb":
    case "array":
    case "set": {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      return value;
    }
    default:
      return value;
  }
}
function buildRowValues(collection, row) {
  var _a;
  const values = {};
  for (const [key, raw] of Object.entries(row)) {
    if (key.includes(".")) continue;
    const field = (_a = collection == null ? void 0 : collection.getField) == null ? void 0 : _a.call(collection, key);
    if (collection && !field) continue;
    values[key] = coerceValue(field == null ? void 0 : field.type, raw);
  }
  return values;
}
async function importEnhanced(ctx, next) {
  var _a, _b;
  const repository = (0, import_repository.getCurrentRepository)(ctx);
  const collection = repository.collection;
  const file = ctx.file || ((_a = ctx.request) == null ? void 0 : _a.file);
  if (!(file == null ? void 0 : file.buffer)) {
    return ctx.throw(400, 'Import file is required (multipart field "file")');
  }
  const body = ctx.request.body || {};
  const columns = (0, import_repository.parseMaybeJson)(body.columns, []);
  if (!Array.isArray(columns) || !columns.length) {
    return ctx.throw(400, "columns is required");
  }
  const mode = ["append", "update", "overwrite"].includes(body.mode) ? body.mode : "append";
  const filter = (0, import_repository.parseMaybeJson)(body.filter, void 0);
  const pk = (0, import_repository.getPrimaryKey)(collection);
  const importableColumns = columns.filter((c) => typeof c.dataIndex === "string" && !c.dataIndex.includes("."));
  if (!importableColumns.length) {
    return ctx.throw(400, "No importable (non-association) columns selected");
  }
  const rows = await (0, import_xlsx.readXlsxRows)(file.buffer, importableColumns);
  const db = repository.database || ctx.db || ((_b = ctx.app) == null ? void 0 : _b.db);
  const transaction = await db.sequelize.transaction();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  try {
    if (mode === "overwrite") {
      if (filter && Object.keys(filter).length) {
        await repository.destroy({ filter, transaction });
      } else {
        await repository.destroy({ truncate: true, transaction });
      }
    }
    for (let i = 0; i < rows.length; i++) {
      const values = buildRowValues(collection, rows[i]);
      try {
        if (mode === "update") {
          const pkValue = values[pk] ?? rows[i][pk];
          delete values[pk];
          if (pkValue === null || pkValue === void 0 || pkValue === "" || !Object.keys(values).length) {
            skipped++;
            continue;
          }
          const exists = await repository.findOne({ filterByTk: pkValue, transaction });
          if (!exists) {
            skipped++;
            continue;
          }
          await repository.update({ filterByTk: pkValue, values, transaction });
          updated++;
        } else {
          if (mode === "append") {
            delete values[pk];
          }
          if (!Object.keys(values).length) {
            skipped++;
            continue;
          }
          await repository.create({ values, transaction });
          created++;
        }
      } catch (err) {
        throw new Error(`Row ${i + 2}: ${(err == null ? void 0 : err.message) || err}`);
      }
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
  ctx.body = { mode, total: rows.length, created, updated, skipped };
  await next();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  importEnhanced
});
