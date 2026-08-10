/**
 * Shared constants and the settings model of the tab-page plugin.
 *
 * This file is bundled into the **server** build as well as both client lanes,
 * so it MUST NOT import anything from `react`, `@nocobase/client` or
 * `@nocobase/client-v2`.
 */

/** Plugin package name — used as the i18n namespace and the settings key. */
export const PLUGIN_NAME = '@simo/plugin-tab-page';

/** Name of the single-row collection holding the global settings. */
export const SETTINGS_COLLECTION = 'simoTabPageConfig';

/**
 * Resource exposed by the server for reading/writing the global settings.
 * Deliberately different from {@link SETTINGS_COLLECTION} so the custom
 * `get` / `update` actions do not shadow the collection's built-in CRUD.
 */
export const SETTINGS_RESOURCE = 'simoTabPageSettings';

/** Key of the entry registered in the plugin settings manager. */
export const SETTINGS_PAGE_KEY = 'tab-page';

/** ACL snippet gating *menu access* to the plugin settings page. */
export const SETTINGS_ACL_SNIPPET = `pm.${SETTINGS_PAGE_KEY}`;

/**
 * ACL snippet guarding *writes* to the global settings.
 *
 * It is exposed as a **second, hidden page** of the plugin settings entry
 * (`pm.tab-page.global`, shown in the role permission UI as 标签页 → 全局配置),
 * so it lives in the same "插件设置" tree as the menu/visibility snippets
 * instead of as a bare resource action. A regular user who can only open the
 * settings page (and tune their own browser) therefore cannot change the
 * instance-wide defaults — that stays an administrator-only capability.
 */
export const SETTINGS_CONFIG_ACL_SNIPPET = `pm.${SETTINGS_PAGE_KEY}.global`;

/** localStorage key holding the *personal* overrides of the current browser. */
export const LOCAL_PREFS_KEY = 'simo-tab-page:prefs';

/** sessionStorage key holding the open tab list, so a reload can restore it. */
export const SESSION_TABS_KEY = 'simo-tab-page:tabs';

/* ------------------------------------------------------------------ *
 * Settings model
 * ------------------------------------------------------------------ */

/** When the close (×) button of a tab is visible. */
export type CloseButtonVisibility = 'always' | 'hover' | 'active';

/** What to do when {@link TabPageSettings.maxTabs} is reached. */
export type OverflowStrategy = 'closeOldest' | 'blockNew';

/** Preset height / font scale of the tab bar. */
export type TabSize = 'small' | 'middle' | 'large';

/** Visual style of a tab. */
export type TabShape = 'card' | 'round' | 'line';

export interface TabPageSettings {
  /**
   * Master switch. When `false` the layout renders exactly like stock
   * NocoBase — this is what makes "disable the plugin ⇒ back to normal"
   * possible without uninstalling anything.
   */
  enabled: boolean;

  /* ---- capacity ---- */
  /** Maximum number of simultaneously open tabs. `0` means unlimited. */
  maxTabs: number;
  /** Behaviour once {@link maxTabs} is reached. */
  overflowStrategy: OverflowStrategy;

  /* ---- size & look ---- */
  tabSize: TabSize;
  tabShape: TabShape;
  /** Maximum width of one tab, in px. Longer titles are ellipsized. */
  tabMaxWidth: number;
  /** Minimum width of one tab, in px. */
  tabMinWidth: number;
  /** Show the menu icon in front of the tab title. */
  showIcon: boolean;
  /** Show the "reload current page" button on the right of the bar. */
  showRefreshButton: boolean;

  /* ---- close behaviour ---- */
  closeButtonVisibility: CloseButtonVisibility;
  /** Middle-click (mouse wheel) a tab to close it. */
  closeOnMiddleClick: boolean;
  /** Right-click a tab to open the batch-close context menu. */
  contextMenuEnabled: boolean;
  /** Pin the very first tab (the "home" tab) so it can never be closed. */
  pinHomeTab: boolean;
  /** Refuse to close the last remaining tab. */
  keepAtLeastOneTab: boolean;
  /**
   * Destroy the underlying page model when a tab is closed.
   *
   * `false` (default) only drops the tab from the bar and lets NocoBase's own
   * page cache expire naturally — safest, because cached React subtrees keep
   * references to the page model. `true` frees memory immediately, at the cost
   * of rebuilding the page from scratch when it is opened again.
   */
  destroyOnClose: boolean;

  /* ---- misc ---- */
  /** Re-create the tab bar after a browser reload (pages re-mount fresh). */
  restoreTabsOnReload: boolean;
}

/** Global settings row, plus the admin-only switch gating personal overrides. */
export interface TabPageGlobalConfig extends TabPageSettings {
  /** Allow every user to override part of the settings in their browser. */
  allowUserOverride: boolean;
}

/**
 * The subset of settings a regular user may override. Capacity and lifecycle
 * options stay admin-only so one user cannot blow up the memory budget agreed
 * for the whole instance.
 */
export const USER_OVERRIDABLE_KEYS = [
  'enabled',
  'tabSize',
  'tabShape',
  'tabMaxWidth',
  'showIcon',
  'showRefreshButton',
  'closeButtonVisibility',
  'closeOnMiddleClick',
  'contextMenuEnabled',
  'restoreTabsOnReload',
] as const;

/** Personal overrides stored in `localStorage`. */
export type TabPagePrefs = Partial<Pick<TabPageSettings, (typeof USER_OVERRIDABLE_KEYS)[number]>>;

/** Hard-coded fallback used before the server answers, and on error. */
export const BUILT_IN_DEFAULTS: TabPageGlobalConfig = {
  enabled: true,

  maxTabs: 10,
  overflowStrategy: 'closeOldest',

  tabSize: 'middle',
  tabShape: 'card',
  tabMaxWidth: 180,
  tabMinWidth: 90,
  showIcon: true,
  showRefreshButton: true,

  closeButtonVisibility: 'hover',
  closeOnMiddleClick: true,
  contextMenuEnabled: true,
  pinHomeTab: true,
  keepAtLeastOneTab: true,
  destroyOnClose: false,

  restoreTabsOnReload: true,

  allowUserOverride: true,
};

/** Pixel metrics derived from {@link TabPageSettings.tabSize}. */
export const TAB_SIZE_METRICS: Record<TabSize, { height: number; fontSize: number; gap: number; padding: number }> = {
  small: { height: 26, fontSize: 12, gap: 4, padding: 8 },
  middle: { height: 32, fontSize: 13, gap: 6, padding: 10 },
  large: { height: 40, fontSize: 14, gap: 8, padding: 14 },
};

/** Upper bound accepted by the settings form — keeps the UI sane. */
export const MAX_TABS_LIMIT = 50;
