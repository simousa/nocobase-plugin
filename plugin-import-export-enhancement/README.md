# @simo/plugin-import-export-enhancement

> 表格区块导入/导出增强 —— 自定义导出字段与范围、追加/更新/覆盖三种导入模式，以及一键下载导入模板。

## 简介

`@simo/plugin-import-export-enhancement` 是 NocoBase 2.x 的一个数据导入导出增强插件。它在表格区块上新增 **Export (Enhanced)（导出增强）** 与 **Import (Enhanced)（导入增强）** 两个动作，解决了官方导入导出在「字段选择、导出范围、导入更新策略」上的限制。

服务端基于 `SheetJS (xlsx)` 在本地读写 `.xlsx`，**不依赖 `exceljs` 及其传递依赖（如 bluebird）**，避免 NocoBase 服务端环境下的运行时问题。

## 功能特性

### 增强导出（Export Enhanced）
- **字段级选择**：对话框中勾选要导出的字段（含关联字段的 `.` 路径，如 `author.name`）。
- **导出范围**：当前筛选后的数据 / 整个集合 / 选中的行（三选一）。
- **可配置「可导出字段」**：在动作设置齿轮中预先限定允许导出的字段白名单。
- 以 `xlsx` 二进制附件形式返回，文件名取自集合标题。

### 增强导入（Import Enhanced）
- **三种导入模式**：
  - **追加（append）**：忽略主键列，每行作为新记录创建。
  - **更新（update）**：按主键匹配已有记录，仅更新导入的字段列，其余字段保持不变。
  - **覆盖（overwrite）**：先删除当前筛选范围内（或整表）的记录，再写入表格数据（危险操作，带醒目警告）。
- **字段级选择**：仅导入勾选的普通字段（关联字段不可导入）。
- **类型擦除（coerce）**：根据字段类型自动转换单元格值（布尔、数值、日期、JSON/数组等）。
- **事务安全**：整个导入在数据库事务中执行，失败自动回滚；返回 `created/updated/skipped` 统计。
- **模板下载**：一键下载仅含表头的 `.xlsx` 模板，便于用户按格式填表。

### 其它
- 支持中英文双语（`zh-CN` / `en-US`）。
- 动作设置齿轮提供：按钮编辑、联动规则、可导入/可导出字段配置、删除。

## 工作原理

| 层级 | 关键文件 | 说明 |
| --- | --- | --- |
| 服务端动作 | `src/server/actions/export-enhanced.ts` | `exportEnhanced` 资源动作：根据 `columns/filter/sort` 查询并生成 xlsx。 |
| 服务端动作 | `src/server/actions/import-enhanced.ts` | `importEnhanced` 资源动作：解析上传的 xlsx，按 `mode` 执行 append/update/overwrite。 |
| 服务端动作 | `src/server/actions/download-template.ts` | `downloadImportTemplate` 资源动作：生成仅含表头的模板。 |
| 服务端工具 | `src/server/utils/xlsx.ts` | 基于 SheetJS 的 `buildXlsxBuffer` / `readXlsxRows`，用 `{dataIndex, title}` 配置在记录与行之间转换。 |
| 服务端 | `src/server/plugin.ts` | 注册三个动作 + 上传中间件，并对登录用户授权。 |
| 客户端 v2 | `src/client-v2/models/ExportEnhancedActionModel.tsx` | 导出动作模型 + 导出对话框（范围/字段选择）。 |
| 客户端 v2 | `src/client-v2/models/ImportEnhancedActionModel.tsx` | 导入动作模型 + 导入对话框（模式/字段/上传）。 |
| 客户端 v1 | `src/client/settings.ts` | 注册 `actionSettings:exportEnhanced` / `actionSettings:importEnhanced` 齿轮菜单（在 v2 UI 中同样生效）。 |

**数据流（导出）**：客户端选择字段+范围 → 调用 `exportEnhanced` → 服务端 `repository.find` → `buildXlsxBuffer` → 返回 xlsx 附件。
**数据流（导入）**：客户端上传 xlsx + columns + mode → `importEnhanced` 解析行 → 逐行 `coerceValue` → 按模式 create/update/destroy → 事务提交，返回统计。

## 目录结构

```
plugin-import-export-enhancement/
├── package.json
├── src/
│   ├── index.ts
│   ├── server/
│   │   ├── plugin.ts
│   │   ├── actions/
│   │   │   ├── export-enhanced.ts
│   │   │   ├── import-enhanced.ts
│   │   │   └── download-template.ts
│   │   ├── middleware/upload.ts
│   │   └── utils/
│   │       ├── xlsx.ts
│   │       └── repository.ts
│   ├── client/                         # 旧版客户端
│   │   ├── plugin.tsx
│   │   ├── settings.ts
│   │   ├── components/{Export,Import}EnhancedAction.tsx
│   │   └── utils.ts
│   ├── client-v2/                     # 新版客户端
│   │   ├── plugin.tsx
│   │   ├── models/{Export,Import}EnhancedActionModel.tsx
│   │   └── utils.ts
│   └── locale/{zh-CN,en-US}.json
```

## 安装与构建

```bash
# 在 NocoBase 插件管理中启用本插件
```

> 注意：本插件在构建期依赖 `xlsx`（声明于 `devDependencies`），需确保其可被打包进服务端 bundle。

## 依赖与环境

- **devDependencies**：`xlsx@^0.20.3`
- **peerDependencies**：`@nocobase/client@2.x`、`@nocobase/client-v2@2.x`、`@nocobase/server@2.x`、`@nocobase/test@2.x`
- **NocoBase 版本**：要求 `2.x`

## 使用说明

1. 在表格区块的工具栏「添加动作」中选择 **导出（增强）** / **导入（增强）**。
2. **导出**：点击动作 → 选择导出范围与字段 → 开始导出。
3. **导入**：点击动作 → 选择模式（追加/更新/覆盖）→ 勾选字段 →（可选）下载模板 → 拖入 xlsx → 开始导入。

