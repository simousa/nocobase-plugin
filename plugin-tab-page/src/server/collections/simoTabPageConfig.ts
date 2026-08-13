import { defineCollection } from '@nocobase/database';

/** Single-row global default configuration stored as a JSON blob in `options`. */
export const DEFAULT_GLOBAL_CONFIG = {
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

export default defineCollection({
  name: 'simoTabPageConfig',
  title: 'Multi-tab Global Config',
  // Single-row global default configuration shared by every user.
  // `options` holds ONLY the global config (style, behavior, top-level default/pinned
  // tabs). Per-portal default/pinned tabs live in `portal_tab` so the two concerns are
  // stored and permissioned independently (avoids the earlier bug where portal tabs were
  // nested inside `options` and could shadow personal preferences).
  fields: [
    { type: 'json', name: 'options', defaultValue: {} },
    { type: 'json', name: 'portal_tab', defaultValue: {} },
  ],
});
