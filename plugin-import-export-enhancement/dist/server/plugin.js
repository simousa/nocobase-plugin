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
  PluginImportExportEnhancementServer: () => PluginImportExportEnhancementServer,
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);
var import_server = require("@nocobase/server");
var import_export_enhanced = require("./actions/export-enhanced");
var import_import_enhanced = require("./actions/import-enhanced");
var import_download_template = require("./actions/download-template");
var import_upload = require("./middleware/upload");
const ACTIONS = ["exportEnhanced", "importEnhanced", "downloadImportTemplate"];
class PluginImportExportEnhancementServer extends import_server.Plugin {
  async afterAdd() {
  }
  async beforeLoad() {
  }
  async load() {
    this.app.dataSourceManager.afterAddDataSource((dataSource) => {
      var _a;
      const resourceManager = dataSource.resourceManager;
      if (!resourceManager) return;
      resourceManager.use(import_upload.importEnhancedMiddleware);
      resourceManager.registerActionHandlers({
        exportEnhanced: import_export_enhanced.exportEnhanced,
        importEnhanced: import_import_enhanced.importEnhanced,
        downloadImportTemplate: import_download_template.downloadImportTemplate
      });
      (_a = dataSource.acl) == null ? void 0 : _a.allow("*", ACTIONS, "loggedIn");
    });
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
var plugin_default = PluginImportExportEnhancementServer;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PluginImportExportEnhancementServer
});
