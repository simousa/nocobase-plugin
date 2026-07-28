# @simo/plugin-enhanced-table

> 增强表格区块 —— 为 NocoBase 表格区块增加「底部汇总行」与「拖选统计」两类数据分析能力，让用户在表格里就能像 Excel 一样快速计算。

## 简介

`@simo/plugin-enhanced-table` 是 NocoBase 2.x 的一个区块增强插件。它在官方表格区块（`TableBlockModel`）的基础上派生出新的 **Enhanced Table（增强表格）** 区块，提供了两类面向数据分析的增强：

1. **底部汇总行（Footer Summary）**：自动对数值型列计算 **求和 / 平均值 / 最大值 / 最小值 / 计数**，渲染为 antd `Table.Summary` 固定底栏。
2. **拖选统计（Selection Stats）**：用鼠标在表格上拖拽框选单元格，仿 Excel 状态栏实时弹出统计（计数、数值计数、求和、平均、最大、最小）。

两类能力均可在区块设置中独立开关，并选择需要显示的统计项。

## 功能特性

- **数值列自动识别**：根据集合字段的 `type`（integer / float / decimal / percent …）或界面类型（integer / number / percent）自动判断是否为数值列，仅对数值列汇总。
- **底部汇总行**：利用 antd `Table.Summary` 渲染固定底栏，与列对齐；支持配置显示的统计项（`sum` / `average` / `max` / `min` / `count`）。
- **拖选统计浮层**：鼠标按下拖拽框选，自动高亮选中单元格，在右上角浮层中显示统计结果；兼容文本、日期、含字母的编号（非纯数字会被忽略）。
- **Excel 状态栏语义**：`SelectionStatsView` 解析单元格的「显示文本」而非原始数据，符合用户在 Excel 中框选看状态的直觉；智能识别千分位、货币符号、百分号。
- **可配置**：通过区块设置流（`enhancedTableSettings`）提供「显示底部汇总行」「显示拖选统计」「显示的统计值」三个开关/选择器。
- **中英文双语**：内置 `zh-CN` / `en-US` 语言包。

## 工作原理

| 层级 | 关键文件 | 说明 |
| --- | --- | --- |
| 客户端 v2 | `src/client-v2/models/EnhancedTableBlockModel.tsx` | 继承 `TableBlockModel`，`onMount` 注入 `summary` 渲染器；`renderComponent` 包裹 `SelectionStatsView`。 |
| 客户端 v2 | `src/client-v2/components/SelectionStatsView.tsx` | 纯 DOM 监听 `mousedown/mousemove/mouseup` 实现框选，弹出统计浮层（通过 portal 渲染到 `document.body`）。 |
| 客户端 v1 | `src/client/plugin.tsx` | 注册流引擎模型（兼容旧版 UI）。 |
| 服务端 | `src/server/plugin.ts` | 占位 `Plugin` 类（本插件逻辑主要在客户端，服务端无自定义动作）。 |

区块通过 `EnhancedTableBlockModel.define({...})` 注册到区块选择器（`group: Content`，`sort: 310`），并通过 `registerFlow` 暴露「增强表格设置」配置流。

## 目录结构

```
plugin-enhanced-table/
├── package.json
├── src/
│   ├── index.ts                      # 服务端入口（导出 server）
│   ├── server/
│   │   └── plugin.ts                # 服务端 Plugin 类（占位）
│   ├── client/                      # 旧版 (@nocobase/client) 客户端入口
│   │   ├── plugin.tsx
│   │   ├── index.tsx
│   │   └── models/index.ts
│   ├── client-v2/                  # 新版 (@nocobase/client-v2) 客户端
│   │   ├── plugin.tsx
│   │   ├── index.tsx
│   │   ├── models/EnhancedTableBlockModel.tsx
│   │   └── components/SelectionStatsView.tsx
│   └── locale/
│       ├── zh-CN.json
│       └── en-US.json
```

## 安装与构建

作为 NocoBase 插件，需在本仓库的 NocoBase 应用中构建并启用：

```bash
# 「插件管理」-> 找到 Enhanced Table -> 启用
```

## 依赖与环境

- **peerDependencies**：`@nocobase/client@2.x`、`@nocobase/client-v2@2.x`、`@nocobase/server@2.x`、`@nocobase/test@2.x`
- **运行依赖**：无（纯基于 antd + flow-engine）
- **NocoBase 版本**：要求 `2.x`

## 使用说明

1. 在页面设计中新增一个「增强表格（Enhanced table）」区块。
2. 配置数据源与字段列。
3. 打开区块设置，进入「增强表格设置」：
   - 开启「显示底部汇总行」，并勾选需要展示的统计项；
   - 开启「显示拖选统计」后，在表格中按住鼠标拖拽框选单元格即可查看实时统计。
