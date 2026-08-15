/**
 * Locale keys for every multi-tab setting tooltip.
 *
 * The actual bilingual text lives in `src/locale/{zh-CN,en-US}.json` and is resolved
 * by `t(key)` according to the current user language (req #3). Keys intentionally use
 * no `.` or `:` so i18next treats them as flat keys.
 */
export const TIP = {
  enabled: 'tipEnabled',
  allowPersonalization: 'tipAllowPersonalization',
  maxTabs: 'tipMaxTabs',
  maxBehavior: 'tipMaxBehavior',
  style: 'tipStyle',
  roundedRadius: 'tipCornerRadius',
  barPosition: 'tipBarPosition',
  fixedWidth: 'tipFixedWidth',
  fixedTabWidth: 'tipFixedTabWidth',
  minTabWidth: 'tipMinTabWidth',
  maxTabWidth: 'tipMaxTabWidth',
  tabHeight: 'tipTabHeight',
  showMenuIcon: 'tipShowMenuIcon',
  showRefresh: 'tipShowRefresh',
  closeButtonMode: 'tipCloseButtonMode',
  closeButtonPosition: 'tipCloseButtonPosition',
  middleClickClose: 'tipMiddleClickClose',
  contextMenu: 'tipContextMenu',
  pinFirstTab: 'tipPinFirstTab',
  keepAtLeastOne: 'tipKeepAtLeastOne',
  restoreAfterRefresh: 'tipRestoreAfterRefresh',
  defaultTabs: 'tipDefaultTabs',
  pinnedTabs: 'tipPinnedTabs',
  portalScope: 'tipPortalScope',
};

/** Locale key for the personal-preference notice shown at the top of the personal page. */
export const PERSONAL_NOTE = 'personalNote';
