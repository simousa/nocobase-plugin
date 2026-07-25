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
var xlsx_exports = {};
__export(xlsx_exports, {
  buildXlsxBuffer: () => buildXlsxBuffer,
  readXlsxRows: () => readXlsxRows
});
module.exports = __toCommonJS(xlsx_exports);
var XLSX = __toESM(require("xlsx"));
function getByPath(obj, path) {
  if (!obj || !path) return void 0;
  if (path.indexOf(".") === -1) return obj[path];
  return path.split(".").reduce((acc, key) => acc == null ? acc : acc[key], obj);
}
function scalarify(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("id" in v) return v.id;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return v;
}
function toCellValue(value) {
  if (value === null || value === void 0) return "";
  if (value instanceof Date) return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map((v) => scalarify(v)).filter((v) => v !== "" && v != null).join(", ");
    }
    if ("id" in value) return value.id;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}
async function buildXlsxBuffer(columns, rows) {
  const aoa = [columns.map((c) => c.title || c.dataIndex)];
  for (const row of rows || []) {
    aoa.push(columns.map((c) => toCellValue(getByPath(row, c.dataIndex))));
  }
  const worksheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  worksheet["!cols"] = columns.map(() => ({ wch: 20 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
async function readXlsxRows(buffer, columns) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true });
  if (!aoa.length) return [];
  const headers = (aoa[0] || []).map((h) => h == null ? "" : String(h).trim());
  const titleToCol = {};
  headers.forEach((h, idx) => {
    if (h && !(h in titleToCol)) titleToCol[h] = idx;
  });
  const colMap = columns.map((c) => ({
    field: c.dataIndex,
    col: titleToCol[c.title] ?? titleToCol[c.dataIndex]
  })).filter((m) => m.col !== void 0);
  const rows = [];
  for (let r = 1; r < aoa.length; r++) {
    const rowArr = aoa[r] || [];
    const obj = {};
    let hasValue = false;
    for (const { field, col } of colMap) {
      const v = rowArr[col] ?? null;
      obj[field] = v;
      if (v !== null && v !== "" && v !== void 0) hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }
  return rows;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildXlsxBuffer,
  readXlsxRows
});
