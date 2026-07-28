# NocoBase 增强插件集

本仓库包含相互独立、面向 [NocoBase](https://www.nocobase.com/) 2.x 的增强插件小项目，由AI开发。

## 插件总览

| 子项目 | 名称 | 主要能力 |
| --- | --- | --- |
| [`plugin-enhanced-table`](./plugin-enhanced-table/README.md) | Enhanced Table | 底部数值汇总行（求和/平均/最大/最小/计数）+ 拖选统计浮层（Excel 状态栏式） |
| [`plugin-import-export-enhancement`](./plugin-import-export-enhancement/README.md) | Import/Export Enhancement | 字段级导出范围选择；追加/更新/覆盖三模式导入；模板下载（基于 SheetJS 本地生成 xlsx） |
| [`plugin-verification-code`](./plugin-verification-code/README.md) | Verification code (CAPTCHA) | 本地生成字符/算术验证码，保护登录/注册/忘记密码/公开表单，零第三方 API 依赖 |

## 共同技术栈与结构

三个插件共享同一套 NocoBase 2.x 插件骨架：

- **NocoBase 版本**：均要求 `@nocobase/*@2.x`。
- **双客户端入口**：每个插件都同时包含旧版 `@nocobase/client`（v1）与新版 `@nocobase/client-v2`（基于 flow-engine 的 `Plugin` / `ActionModel` / `TableBlockModel`）的客户端代码，以兼容不同版本的 UI。
- **服务端入口**：`src/server/plugin.ts` 继承 `@nocobase/server` 的 `Plugin`，负责注册资源动作、中间件、验证类型与 ACL。
- **国际化简洁**：均内置 `src/locale/zh-CN.json` 与 `en-US.json` 双语包。
- **构建产物**：`client.js` / `client-v2.js` / `server.js` 等由源码 `src/` 编译而来（见各子目录 `.npmignore`）。

典型目录约定：

```
<plugin>/
├── package.json
├── README.md
└── src/
    ├── index.ts
    ├── server/                # @nocobase/server
    ├── client/                # @nocobase/client (v1)
    ├── client-v2/             # @nocobase/client-v2 (flow-engine)
    └── locale/{zh-CN,en-US}.json
```


## 备注

插件彼此独立，可单独启用，互不依赖，本项目全部或部分由人工智能（AI）辅助生成。
