export interface MultiTabItem {
  title: string;
  /** FULL pathname (including the app basename), e.g. /admin/pm/list */
  path: string;
  /**
   * Icon represented either as:
   *  - an HTML string starting with '<' (the cloned `.anticon` markup scraped
   *    from the active menu item for auto-created tabs), or
   *  - an antd icon component name (e.g. "AppstoreOutlined") for admin-configured
   *    default / pinned tabs.
   */
  icon?: string;
  /** Whether the tab can be closed. Pinned / first-pinned tabs are not closable. */
  closable?: boolean;
  /** Runtime-pinned by the user via the right-click menu (non-closable). */
  pinned?: boolean;
}

export type MultiTabStyle = 'card' | 'rounded' | 'underline';
/** What happens when the number of open tabs reaches maxTabs */
export type MaxBehavior = 'lru' | 'block';
/** When the close button is visible */
export type CloseButtonMode = 'always' | 'hover' | 'active';
/** Where the tab bar is mounted */
export type BarPosition = 'page' | 'sidebar';

export interface MultiTabConfig {
  /** Master switch: enable the multi-tab mode */
  enabled: boolean;
  /** Allow end users to tune appearance & close behavior in their own browser */
  allowPersonalization: boolean;

  /** Maximum number of open (non-pinned) tabs. 0 = unlimited. Default 10. */
  maxTabs: number;
  /** Behavior when maxTabs is reached */
  maxBehavior: MaxBehavior;

  /** Visual style of the tab bar */
  style: MultiTabStyle;

  /** Use a fixed pixel width for every tab */
  fixedWidth: boolean;
  /** Width (px) used when fixedWidth is true */
  fixedTabWidth: number;
  /** Minimum width (px) used when fixedWidth is false (adaptive) */
  minTabWidth: number;
  /** Maximum width (px) used when fixedWidth is false (adaptive) */
  maxTabWidth: number;
  /** Height (px) of the tab bar */
  tabHeight: number;
  /** Corner radius (px) used by the "rounded" style. Range 0-16, default 5. */
  roundedRadius: number;

  /** Show the route/menu icon next to the tab title */
  showMenuIcon: boolean;
  /** Show a refresh button at the far right of the bar */
  showRefresh: boolean;
  /** When the per-tab close button is shown */
  closeButtonMode: CloseButtonMode;
  /** Close a tab with the mouse middle button */
  middleClickClose: boolean;
  /** Right-click context menu (pin / close others / close left / close right) */
  contextMenu: boolean;
  /** Pin the very first opened page so it cannot be closed */
  pinFirstTab: boolean;
  /** Keep at least one tab open at all times */
  keepAtLeastOne: boolean;
  /** Restore open tabs after a browser refresh (F5) */
  restoreAfterRefresh: boolean;

  /** Where the bar is mounted: full page width (over the sider) or right of the sider */
  barPosition: BarPosition;

  /** Seed tabs opened by default for every user (the "Default (all portals)" scope) */
  defaultTabs: MultiTabItem[];
  /** Always-present, non-closable tabs (the "Default (all portals)" scope) */
  pinnedTabs: MultiTabItem[];
}

/**
 * Shape of the `portal_tab` column: per-portal default/pinned tabs only.
 *
 * This is a SEPARATE concern from `MultiTabConfig` (`options`). It is keyed by the
 * NocoBase `portalName` (see `utils/portal.ts`) so it lines up with the runtime
 * portal resolution, and it is stored in its own DB column with its own permission
 * snippet — configuring portal tabs never mutates or reads the global config blob.
 * Personal preferences are browser-local and never stored here.
 */
export interface PortalTabConfig {
  portals: Record<string, { defaultTabs: MultiTabItem[]; pinnedTabs: MultiTabItem[] }>;
}

export const DEFAULT_CONFIG: MultiTabConfig = {
  enabled: true,
  allowPersonalization: true,

  maxTabs: 10,
  maxBehavior: 'lru',

  style: 'card',

  fixedWidth: false,
  fixedTabWidth: 160,
  minTabWidth: 80,
  maxTabWidth: 200,
  tabHeight: 42,
  roundedRadius: 5,

  showMenuIcon: true,
  showRefresh: true,
  closeButtonMode: 'always',
  middleClickClose: true,
  contextMenu: true,
  pinFirstTab: false,
  keepAtLeastOne: true,
  restoreAfterRefresh: true,

  barPosition: 'page',

  defaultTabs: [],
  pinnedTabs: [],
};

/** Fields a normal user is allowed to personalize in their browser. */
export const PERSONALIZABLE_FIELDS: (keyof MultiTabConfig)[] = [
  'style',
  'fixedWidth',
  'fixedTabWidth',
  'minTabWidth',
  'maxTabWidth',
  'tabHeight',
  'roundedRadius',
  'showMenuIcon',
  'showRefresh',
  'closeButtonMode',
  'middleClickClose',
  'contextMenu',
  'pinFirstTab',
  'keepAtLeastOne',
  'barPosition',
];

/** Build a fresh config object from a (possibly partial) source. */
export function normalizeConfig(src: Partial<MultiTabConfig> | undefined | null): MultiTabConfig {
  const c = { ...DEFAULT_CONFIG, ...(src || {}) } as MultiTabConfig;
  if (typeof c.maxTabs !== 'number' || c.maxTabs < 0) c.maxTabs = DEFAULT_CONFIG.maxTabs;
  if (typeof c.fixedTabWidth !== 'number' || c.fixedTabWidth < 40) c.fixedTabWidth = DEFAULT_CONFIG.fixedTabWidth;
  if (typeof c.minTabWidth !== 'number' || c.minTabWidth < 40) c.minTabWidth = DEFAULT_CONFIG.minTabWidth;
  if (typeof c.maxTabWidth !== 'number' || c.maxTabWidth < c.minTabWidth)
    c.maxTabWidth = Math.max(DEFAULT_CONFIG.maxTabWidth, c.minTabWidth);
  if (typeof c.tabHeight !== 'number' || c.tabHeight < 28) c.tabHeight = DEFAULT_CONFIG.tabHeight;
  if (typeof c.roundedRadius !== 'number' || c.roundedRadius < 0 || c.roundedRadius > 16)
    c.roundedRadius = DEFAULT_CONFIG.roundedRadius;
  if (c.barPosition !== 'page' && c.barPosition !== 'sidebar') c.barPosition = DEFAULT_CONFIG.barPosition;
  return c;
}
