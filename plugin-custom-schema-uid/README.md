# @simo/plugin-custom-schema-uid

为 NocoBase 的桌面菜单 / 路由提供「自定义 Schema UID（路由 ID）」能力：在创建菜单项、在已有菜单项前后/组内插入子项时，可以手动指定页面路由的 `schemaUid`，取代 NocoBase 默认生成的随机字符串（如 `6gsxk2oawhs`）。


## 适用版本

- NocoBase v2.x（`@nocobase/client-v2`）


## 功能

1. **添加菜单项（页面 / 流程页面）**：在「添加菜单项」弹窗的「菜单项名称」下方出现「自定义 Schema UID」输入框，填写后该页面路由即变为 `/v/admin/<your-schema-uid>`。
2. **插入子菜单项**：在菜单项的「更多」菜单中「在前面插入 / 在后面插入」，以及在分组（Group）的「在前面插入 / 在后面插入 / 在里面插入」弹窗中，同样显示「自定义 Schema UID」字段。
3. **重复校验**：若填写的 Schema UID 已存在，表单的校验器会直接报错（ `自定义 Schema UID "xxx" 已被占用，请更换`），**阻止提交并停留在当前弹窗**。
4. **留空即自动生成**：字段留空时行为与官方一致——仍使用随机 `uid()`。
5. **仅对页面类型生效**：分组（Group）的 URL 由记录 ID 派生、链接（Link）没有页面 schema，因此这两项不显示该字段。
6. **禁用即恢复**：禁用插件后，菜单恢复为官方默认的随机 `uid()` 路由，无需任何额外清理。

### 校验规则

- 仅允许字母、数字、下划线、中划线：`/^[a-zA-Z0-9_-]+$/`
- 最大长度 64
- 需要唯一（有重复时报错）

## 安装

本插件随 NocoBase 主工程以本地包方式安装，包名 `@simo/plugin-custom-schema-uid`。

到 [Release 页](https://github.com/simousa/nocobase-plugin/releases)，下载对应的插件，在`nocobase`->`插件管理器`中启用插件。


## 使用方式

1. 进入桌面端 UI 编辑模式（`/v/admin/`）。
2. 点击「添加菜单项」→ 选择「页面」或「流程页面」→ 在「菜单项名称」下填写「自定义 Schema UID」（例如 `custom-page-a123`）→ 保存。访问 `/v/admin/custom-page-a123`即可命中该页面。
3. 对已有菜单项：右上角「更多」→「在前面插入 / 在后面插入」；对分组项：其「更多」中额外提供「在里面插入」。这些弹窗同样包含「自定义 Schema UID」。

## 已知限制

- **`/settings/routes`（路由设置页）暂未覆盖**。
- 「分组」与「链接」类型不应用自定义 Schema UID（详见上文「仅对页面类型生效」）。

## 下载
https://github.com/simousa/nocobase-plugin/releases