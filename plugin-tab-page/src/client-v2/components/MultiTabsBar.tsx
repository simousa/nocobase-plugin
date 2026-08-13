import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, Button } from 'antd';
import { CloseOutlined, ReloadOutlined, PushpinFilled } from '@ant-design/icons';
import * as Icons from '@ant-design/icons';
import { toRouterNavigationPath } from '../utils/navigation';
import type { MultiTabConfig, MultiTabItem, BarPosition } from '../types';
import { DEFAULT_CONFIG } from '../types';
import {
  loadPersonalConfig,
  saveOpenTabs,
  loadOpenTabs,
  mergeConfig,
  saveActivePath,
  loadActivePath,
  setBarPosition,
  setPortalKey,
} from '../utils/config';
import type { MountProps } from '../utils/dom';
import { applyPortalOverride, PORTAL_RECORDS_UPDATED } from '../utils/portal';

/** Resolve a human title for a path as a last resort (falls back to document.title). */
function titleFor(path: string): string {
  const seg = path.split('/').filter(Boolean).pop();
  return document.title || (seg ? decodeURIComponent(seg) : path);
}

/**
 * Whether a route is an in-page "overlay" rather than a top-level menu navigation.
 * The multi-tab bar should ONLY track menu-level pages (req #1): clicking a record's
 * "View" button, opening a popup / modal / drawer, applying a filter block, or
 * switching an in-page `?tab=` sub-tab must NOT spawn a new browser tab.
 *
 * Markers (per spec): `popups`/`popup` route segment or `?popup=` query, `/view/`
 * detail sub-route, `?filterbytk=`, `?tab=`. Whole-segment matching avoids clipping
 * real menu paths such as `/tables` (contains "tab") or `/preview` (contains "view").
 */
function isOverlayRoute(fullPath: string): boolean {
  const [rawPath = '', rawSearch = ''] = fullPath.split('?');
  const path = rawPath.toLowerCase();
  const search = rawSearch.toLowerCase();
  const hasSegment = (seg: string) => new RegExp(`(^|/)${seg}(/|$)`).test(path);
  if (hasSegment('popups') || hasSegment('popup')) return true;
  if (search.includes('popup=')) return true;
  if (hasSegment('view')) return true;
  if (/(^|&)tab=/.test(search)) return true;
  if (/(^|&)filterbytk=/.test(search)) return true;
  return false;
}

/**
 * Normalize a route path so two references to the "same" page compare equal even when
 * they differ by deployment basename, query string, hash, or trailing slashes.
 * e.g. `/v/admin/abc?x=1` and `/admin/abc` both collapse to `/admin/abc` when the
 * basename is `/v`. This lets a globally-configured default/pinned tab match the page
 * the user actually navigated to, instead of spawning a duplicate tab (req #2).
 */
function normalizeTabPath(p: string, basename: string): string {
  let s = (p || '').split('?')[0].split('#')[0].trim();
  const base = (basename || '').replace(/\/+$/, '');
  if (base && base !== '/' && s.startsWith(base)) {
    s = s.slice(base.length);
  }
  return s.replace(/\/+$/, '') || '/';
}

/**
 * Whether the global config already seeds initial tabs. When it does, the
 * "pin first tab" option is ignored: the first tab from the global config is the
 * "first tab", and any tab the user opens afterwards is NOT pinned (req #2).
 */
function hasGlobalInitialTabs(cfg: MultiTabConfig): boolean {
  return (cfg.pinnedTabs?.length || 0) > 0 || (cfg.defaultTabs?.length || 0) > 0;
}

/**
 * Read the title + icon HTML from the currently selected menu item (the menu entry
 * that corresponds to the active route). This makes each tab show the *real* menu
 * label and icon instead of a fixed/guessed one.
 */
function getActiveMenuMeta(): { title?: string; iconHtml?: string } | null {
  const selected = document.querySelector('.ant-menu-item-selected') as HTMLElement | null;
  if (!selected) return null;
  const titleEl = selected.querySelector('.ant-menu-title-content');
  const title = (titleEl?.textContent || selected.textContent || '').trim();
  // Prefer the item's OWN icon. Child (secondary) menu items frequently have no icon
  // of their own, so when none is found we walk UP to the nearest parent submenu and
  // read its title icon — that gives the secondary-menu icon the user expects on the
  // tab (instead of a blank icon slot).
  let iconEl = selected.querySelector('.anticon');
  if (!iconEl) {
    const submenu = selected.closest('.ant-menu-submenu') as HTMLElement | null;
    if (submenu) iconEl = submenu.querySelector('.ant-menu-submenu-title .anticon');
  }
  const iconHtml = iconEl ? iconEl.outerHTML : undefined;
  if (!title && !iconHtml) return null;
  return { title: title || undefined, iconHtml };
}

/** Render the icon for a tab item: DOM HTML (auto tabs) or an antd icon by name (configured tabs). */
function renderIcon(icon: string | undefined) {
  if (!icon) return null;
  const trimmed = icon.trim();
  if (trimmed.startsWith('<')) {
    return <span className="simo-tab-icon" dangerouslySetInnerHTML={{ __html: trimmed }} />;
  }
  const Cmp = (Icons as any)[trimmed];
  return Cmp ? <Cmp className="simo-tab-icon" /> : null;
}

export function MultiTabsBar(props: MountProps) {
  const { apiClient, navigate, getBasename, t } = props;
  // `props.getPortalKey` resolves the current portal (门户) identity. We mirror it in
  // a ref so route changes can detect a portal switch and re-scope tabs (req #2). We also
  // set the module-level storage namespace synchronously here (BEFORE the async config load)
  // so the very first tab opened before `refreshConfig` resolves is saved under the correct
  // portal key instead of the empty/default namespace.
  const portalKeyRef = useRef(props.getPortalKey ? props.getPortalKey() : 'main');
  setPortalKey(portalKeyRef.current);
  const [config, setConfig] = useState<MultiTabConfig>(DEFAULT_CONFIG);
  const [openTabs, setOpenTabs] = useState<MultiTabItem[]>([]);
  const [activePath, setActivePath] = useState<string>('');
  const [ctx, setCtx] = useState<{ x: number; y: number; path: string | null } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;
  // Mirrors the DISPLAY-order item list (global pinned → runtime pinned → normal) so
  // close-left / close-right operate on visual position instead of the runtime-only
  // openTabs array. This is what makes "close right" work even when global pinned
  // tabs are present (they live outside openTabs) (req #1).
  const allItemsRef = useRef<MultiTabItem[]>([]);
  // Per-portal flag so default tabs are seeded only ONCE per portal (not re-seeded
  // after the user deliberately closes all tabs). Keyed by portal key (req #2).
  const seededRef = useRef<Record<string, boolean>>({});
  // When a portal switch happens we defer the current route's activation until the
  // new portal's config (and its default tabs) have been applied.
  const pendingActivateRef = useRef<string | null>(null);
  // Becomes true only AFTER the first restore pass (mount / portal switch) has run.
  // Until then the open-tabs / active-path persist effects stay silent, so the initial
  // empty render cannot overwrite the saved tabs with `[]` before we restore them
  // (this was the bug behind "refresh loses all but default/pinned tabs").
  const restoredRef = useRef(false);

  /** Navigate using a FULL pathname, converted to the router's basename-relative form. */
  const go = useCallback(
    (fullPath: string) => navigate(toRouterNavigationPath(fullPath, getBasename())),
    [navigate, getBasename],
  );

  /* ---------------- Config loading (global default + personal override) --------------- */

  /**
   * Apply the per-portal (门户) override (see utils/portal.ts `applyPortalOverride`).
   * When the global config carries an entry for the current portal's `portalName`, the
   * FULL entry is merged ON TOP of the base config, so every global setting
   * (default/pinned tabs, height, style, …) can be tuned independently per portal.
   * Portals without an entry fall back to the base (top-level) values. Legacy configs
   * saved under path-segment keys (e.g. "v/erp") are still matched via the basename-
   * prefixed / stripped variants, so upgrading does not wipe previously-saved tabs.
   */
  const refreshConfig = useCallback(
    async (opts?: { restore?: boolean }) => {
      // `restore` (mount + portal switch) reloads THIS portal's tabs from storage (or
      // seeds its defaults). A plain settings save passes restore:false so the user's
      // open tabs are never wiped by a config change.
      const restore = opts?.restore ?? false;
      // The single global-default row now carries TWO independent blobs:
      //   `options`    — the global config only (style, behavior, top-level default/pinned tabs)
      //   `portal_tab` — per-portal default/pinned tabs (shared by all users)
      // We always re-fetch so both stay in sync after any save (a settings save dispatches
      // `simo:config-changed` without a payload, so re-reading is the source of truth).
      let globalCfg: Partial<MultiTabConfig> = {};
      let portalTabMap: Record<string, { defaultTabs: MultiTabItem[]; pinnedTabs: MultiTabItem[] }> = {};
      try {
        const res = await apiClient.request({
          url: 'simoTabPageConfig:list',
          // _t busts any response cache so a manual re-fetch always sees the latest row.
          params: { pageSize: 1, _t: Date.now() },
        });
        const rows = res?.data?.data || [];
        const row = rows[0] || {};
        if (row.options) globalCfg = row.options;
        portalTabMap = (row.portal_tab && row.portal_tab.portals) || {};
      } catch {
        // ignore - fall back to defaults / personal prefs
      }
      // Re-scope storage to the CURRENT portal before reading personal prefs / tabs.
      const portalKey = props.getPortalKey ? props.getPortalKey() : 'main';
      portalKeyRef.current = portalKey;
      setPortalKey(portalKey);

      // Gate on the effective allowPersonalization. Fall back to DEFAULT_CONFIG (true)
      // when the stored `options` is a legacy blob missing this key (pre-migration), so
      // personal preferences load even before an admin re-saves the global config.
      const allowPersonal =
        globalCfg.allowPersonalization ?? DEFAULT_CONFIG.allowPersonalization;
      const personal = allowPersonal ? loadPersonalConfig() : {};
      const merged = mergeConfig(globalCfg, personal);
      // Personal preferences (browser-local) win over the global config; the per-portal
      // tabs (from `portal_tab`) then override ONLY the default/pinned tabs, never the
      // user's style/behavior settings.
      const effective = applyPortalOverride(merged, portalKey, portalTabMap);
      setBarPosition(effective.barPosition as BarPosition);
      setConfig(effective);

      if (!restore) return;
      // A restore pass has run — from now on the persist effects below are allowed to
      // write. (Before this, an empty initial render would persist `[]` and wipe the
      // previously-saved tabs, breaking "restore after refresh".)
      restoredRef.current = true;

      // ---- Deterministic per-portal tab restore (mount + portal switch) ----
      // Everything below is scoped to the current portal (setPortalKey above), so a
      // previous portal's tabs can never leak across (req #2).
      if (!effective.restoreAfterRefresh) {
        // Persistence disabled: start with a clean bar for this portal.
        setOpenTabs([]);
        setActivePath('');
        activePathRef.current = '';
        saveOpenTabs([]);
        saveActivePath('');
        return;
      }
      const saved = loadOpenTabs();
      if (saved.length > 0) {
        // Restore this portal's previously-saved tabs. Pin the first one per the
        // "pin first tab" rule only when the global config does NOT seed initial
        // tabs (otherwise the global first tab wins) — req #2.
        if (effective.pinFirstTab && !hasGlobalInitialTabs(effective)) saved[0].pinned = true;
        setOpenTabs(saved);
        const savedActive = loadActivePath();
        if (savedActive) {
          setActivePath(savedActive);
          activePathRef.current = savedActive;
        }
        seededRef.current[portalKey] = true;
      } else if (effective.defaultTabs.length > 0 && !seededRef.current[portalKey]) {
        // First visit to this portal with no saved tabs: seed its default tabs once.
        const seeded = effective.defaultTabs.map((d) => ({ ...d, closable: true }));
        setOpenTabs(seeded);
        saveOpenTabs(seeded);
        seededRef.current[portalKey] = true;
      } else {
        // New portal with neither saved tabs nor defaults: clear any leftover tabs so
        // the previous portal's tabs never appear here (req #2 fix).
        setOpenTabs([]);
        setActivePath('');
        activePathRef.current = '';
      }
    },
    [apiClient, props],
  );

  /* ---------------- Route change → open / activate tab --------------- */

  /**
   * Mirror the currently selected menu entry's title/icon onto the active tab.
   *
   * Referencing old-src's `routeRepository.subscribe` intent: instead of trusting a
   * single 60ms snapshot (which races the menu's selection animation and lets the
   * tab label briefly mismatch the menu), we keep re-reading the selected item
   * whenever the menu selection settles. A MutationObserver in the effect below
   * drives this on every selection change, so switching tabs always ends up with
   * the correct label.
   */
  const syncActiveTabFromMenu = useCallback(() => {
    const full = activePathRef.current;
    if (!full) return;
    const meta = getActiveMenuMeta();
    if (!meta || (!meta.title && !meta.iconHtml)) return;
    setOpenTabs((prev) => {
      let changed = false;
      const next = prev.map((tb) => {
        if (tb.path !== full) return tb;
        const title = meta.title || tb.title || titleFor(full);
        const icon = meta.iconHtml ?? tb.icon;
        if (tb.title === title && tb.icon === icon) return tb;
        changed = true;
        return { ...tb, title, icon };
      });
      return changed ? next : prev;
    });
  }, []);

  const refreshMeta = useCallback(
    (full: string) => {
      // Defer a tick so the menu's selected state has updated for the new route.
      setTimeout(() => syncActiveTabFromMenu(), 60);
    },
    [syncActiveTabFromMenu],
  );

  const addOrActivate = useCallback(
    (full: string) => {
      const cfg = configRef.current;
      const basename = getBasename();
      const norm = normalizeTabPath(full, basename);
      // "Pin first tab" only applies when the global config does NOT already seed
      // initial tabs; otherwise the global config's first tab is the "first tab" (req #2).
      const pinFirst = cfg.pinFirstTab && !hasGlobalInitialTabs(cfg);

      // (1) A globally-configured PINNED tab matched by path → focus the existing
      //     config tab (it is already rendered from config) and keep its configured
      //     title/icon. Do NOT open a duplicate (req #2).
      const gPin = (cfg.pinnedTabs || []).find(
        (p) => normalizeTabPath(p.path, basename) === norm,
      );
      if (gPin) {
        activePathRef.current = gPin.path;
        setActivePath(gPin.path);
        saveActivePath(gPin.path);
        refreshMeta(gPin.path);
        return;
      }

      activePathRef.current = full;
      setActivePath(full);
      saveActivePath(full);

      setOpenTabs((prev) => {
        // (2) Already open (by normalized path)?
        const exists = prev.some((tb) => normalizeTabPath(tb.path, basename) === norm);
        if (exists) {
          refreshMeta(full);
          return prev;
        }

        // (3) Matches a global DEFAULT tab by path? Use its configured title/icon
        //     rather than the live menu label (req #2): the global config wins.
        const cfgDefault = (cfg.defaultTabs || []).find(
          (d) => normalizeTabPath(d.path, basename) === norm,
        );

        const newItem: MultiTabItem = {
          title: cfgDefault?.title || titleFor(full),
          path: full,
          closable: true,
          icon: cfgDefault?.icon,
          // Pin the first tab when "pin first tab" is enabled (and no global initial
          // tabs exist) — store it as data so the pin state is consistent between the
          // visual pin icon and the right-click menu (req #1).
          pinned: pinFirst && prev.length === 0,
        };

        // Enforce maxTabs before adding.
        let next = [...prev, newItem];
        const max = cfg.maxTabs;
        if (max > 0) {
          const count = next.length;
          if (count > max) {
            if (cfg.maxBehavior === 'block') {
              // Do not open a new tab; keep the current set (active page has no tab).
              return prev;
            }
            // LRU: drop the oldest non-pinned tab.
            let dropped = 0;
            const need = count - max;
            next = next.filter((tb) => {
              if (dropped >= need) return true;
              if (tb.pinned) return true;
              dropped += 1;
              return false;
            });
            if (!next.some((tb) => normalizeTabPath(tb.path, basename) === norm)) {
              next.push(newItem);
            }
          }
        }
        saveOpenTabs(next);
        refreshMeta(full);
        return next;
      });
    },
    [refreshMeta, getBasename],
  );

  const handleRouteChange = useCallback(() => {
    // Detect a portal (门户) switch. Portals are separate URL spaces, so navigating
    // between them changes the resolved portal key. When it does, re-scope storage &
    // config to the new portal and restore ITS tabs — tabs from the previous portal must
    // not leak across (req #2). We defer the current route's activation until the new
    // portal's config + tabs have been applied (see the deferred-activation effect),
    // so the activated tab matches the new portal instead of being opened as a stray
    // runtime tab (and so a remount never clobbers saved tabs — req #1/#2).
    const newKey = props.getPortalKey ? props.getPortalKey() : 'main';
    if (newKey !== portalKeyRef.current) {
      portalKeyRef.current = newKey;
      setPortalKey(newKey);
      pendingActivateRef.current = window.location.pathname;
      refreshConfig({ restore: true });
      return;
    }
    // Overlay routes (popups / record view / filter blocks / in-page sub-tabs) must NOT
    // spawn a browser tab — the bar only tracks menu-level pages (req #1).
    if (isOverlayRoute(window.location.pathname + window.location.search)) return;
    addOrActivate(window.location.pathname);
  }, [addOrActivate, props, refreshConfig]);

  /* ---------------- Close operations --------------- */

  const isClosableNow = useCallback(
    (item: MultiTabItem, index: number, total: number): boolean => {
      const cfg = configRef.current;
      if (item.pinned) return false; // runtime-pinned
      if (index < 0) return false; // global pinned (not in openTabs)
      // "Pin first tab" is ignored once the global config seeds initial tabs, so the
      // first tab is whatever the global config provides — user tabs aren't pinned (req #2).
      const pinFirst = cfg.pinFirstTab && !hasGlobalInitialTabs(cfg);
      if (pinFirst && index === 0 && !openTabsRef.current[0]?.pinned) return false;
      if (cfg.keepAtLeastOne && total <= 1) return false;
      return true;
    },
    [],
  );

  const closeTab = useCallback(
    (path: string) => {
      const idx = openTabsRef.current.findIndex((tb) => tb.path === path);
      if (idx < 0) return;
      const total = openTabsRef.current.length;
      if (!isClosableNow(openTabsRef.current[idx], idx, total)) return;

      const next = openTabsRef.current.filter((tb) => tb.path !== path);
      setOpenTabs(next);
      saveOpenTabs(next);
      if (activePathRef.current === path) {
        const neighbor = next[next.length - 1]?.path || next[0]?.path;
        if (neighbor) go(neighbor);
      }
    },
    [go, isClosableNow],
  );

  const closeOthers = useCallback(
    (path: string) => {
      const next = openTabsRef.current.filter((tb) => tb.pinned || tb.path === path);
      setOpenTabs(next);
      saveOpenTabs(next);
      if (activePathRef.current !== path) go(path);
    },
    [go],
  );

  const closeLeft = useCallback((path: string) => {
    // Operate on DISPLAY order so global pinned tabs (which are outside openTabs) are
    // accounted for. Only runtime tabs whose path is in the "left of clicked" range get
    // removed; pinned tabs (global or runtime) are always kept (req #1).
    const order = allItemsRef.current;
    const dispIdx = order.findIndex((tb) => tb.path === path);
    if (dispIdx <= 0) return;
    const closePaths = order
      .slice(0, dispIdx)
      .filter((tb) => !tb.pinned)
      .map((tb) => tb.path);
    if (!closePaths.length) return;
    const next = openTabsRef.current.filter((tb) => !closePaths.includes(tb.path));
    setOpenTabs(next);
    saveOpenTabs(next);
  }, []);

  const closeRight = useCallback((path: string) => {
    // Same approach as closeLeft but for the "right of clicked" range. Using display
    // order (allItemsRef) makes this work whether the clicked tab is a global pinned
    // tab or a runtime tab (req #1).
    const order = allItemsRef.current;
    const dispIdx = order.findIndex((tb) => tb.path === path);
    if (dispIdx < 0) return;
    const closePaths = order
      .slice(dispIdx + 1)
      .filter((tb) => !tb.pinned)
      .map((tb) => tb.path);
    if (!closePaths.length) return;
    const next = openTabsRef.current.filter((tb) => !closePaths.includes(tb.path));
    setOpenTabs(next);
    saveOpenTabs(next);
  }, []);

  const closeAll = useCallback(() => {
    const next = openTabsRef.current.filter((tb) => tb.pinned);
    setOpenTabs(next);
    saveOpenTabs(next);
    const first = next[0]?.path || configRef.current.pinnedTabs?.[0]?.path;
    if (first) go(first);
  }, [go]);

  const togglePin = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const next = prev.map((tb) => (tb.path === path ? { ...tb, pinned: !tb.pinned } : tb));
      saveOpenTabs(next);
      return next;
    });
  }, []);

  /* ---------------- Effects --------------- */

  /**
   * After a portal switch (or the initial mount), activate the route that triggered
   * the (re)load — but only once the new portal's config AND its restored tabs have
   * been applied (this effect runs after `config` changed in `refreshConfig`, by which
   * point the restored `openTabs` is in `openTabsRef`), so the activated tab matches
   * the new portal instead of being re-opened as a stray runtime tab / clobbering the
   * saved set (req #1/#2).
   */
  useEffect(() => {
    if (!pendingActivateRef.current) return;
    const path = pendingActivateRef.current;
    pendingActivateRef.current = null;
    // Don't seed/activate a tab for an in-page overlay URL (popup / view / filter /
    // in-page sub-tab) — the bar only tracks menu-level pages (req #1).
    if (isOverlayRoute(window.location.pathname + window.location.search)) return;
    addOrActivate(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Persist on change (respecting restoreAfterRefresh). Guarded by restoredRef so the
  // initial empty render cannot wipe the saved tabs before the first restore runs.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (config.restoreAfterRefresh) saveOpenTabs(openTabs);
    else saveOpenTabs([]);
  }, [openTabs, config.restoreAfterRefresh]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (config.restoreAfterRefresh) saveActivePath(activePath);
    else saveActivePath('');
  }, [activePath, config.restoreAfterRefresh]);

  // Init + subscribe to route/config changes.
  useEffect(() => {
    let cancelled = false;
    // Mark the current route for deferred activation. refreshConfig(restore) reloads
    // THIS portal's tabs from storage; once `config` updates, the deferred-activation
    // effect above runs addOrActivate(path) against the restored tabs (no clobber).
    pendingActivateRef.current = window.location.pathname;
    const run = async () => {
      await refreshConfig({ restore: true });
      if (cancelled) return;
    };
    run();
    const onRoute = () => handleRouteChange();
    const onCfg = () => {
      // A settings page (global / portal / personal) changed something. Re-fetch the row
      // so both `options` and `portal_tab` are in sync. restore:false so a config change
      // never wipes the user's currently-open tabs.
      refreshConfig();
    };
    window.addEventListener('simo:route-changed', onRoute);
    window.addEventListener('simo:config-changed', onCfg);
    // When portal records finish loading, re-resolve the current portal key (it may have
    // changed from the initial app-name fallback to the real portalName) and re-scope tabs.
    const onRecords = () => handleRouteChange();
    window.addEventListener(PORTAL_RECORDS_UPDATED, onRecords);
    return () => {
      cancelled = true;
      window.removeEventListener('simo:route-changed', onRoute);
      window.removeEventListener('simo:config-changed', onCfg);
      window.removeEventListener(PORTAL_RECORDS_UPDATED, onRecords);
    };
  }, [refreshConfig, handleRouteChange]);

  // Show/hide the whole injected bar depending on the enabled flag.
  useEffect(() => {
    const el = document.querySelector('.simo-multi-tabs') as HTMLElement | null;
    if (el) el.style.display = config.enabled ? 'flex' : 'none';
  }, [config.enabled]);

  /**
   * Keep the active tab's label icon in sync with the live menu selection.
   * A MutationObserver watches the menu for selection/class changes (and label or
   * icon edits) and re-reads the selected entry — so switching tabs (or a menu
   * rename) never leaves the tab text mismatched with the menu. Debounced to
   * coalesce the burst of mutations fired while the selection animates.
   */
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => syncActiveTabFromMenu(), 30);
    };
    const observer =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null;

    const attach = () => {
      const menu = document.querySelector('.ant-menu');
      if (menu && observer) {
        observer.observe(menu, {
          subtree: true,
          attributes: true,
          attributeFilter: ['class'],
          childList: true,
          characterData: true,
        });
      }
    };
    attach();

    // The menu may mount after the bar first renders — retry until it appears.
    const retry = window.setInterval(() => {
      if (document.querySelector('.ant-menu') && observer) {
        attach();
        window.clearInterval(retry);
      }
    }, 1000);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.clearInterval(retry);
      observer?.disconnect();
    };
  }, [syncActiveTabFromMenu]);

  if (!config.enabled) return null;

  /* ---------------- Render --------------- */

  const globalPinned = (config.pinnedTabs || []).map((p) => ({ ...p, pinned: true, closable: false }));
  const runtimePinned = openTabs.filter((t) => t.pinned).map((t) => ({ ...t, closable: false }));
  const normal = openTabs.filter((t) => !t.pinned);
  const allItems = [...globalPinned, ...runtimePinned, ...normal];
  allItemsRef.current = allItems;
  const total = allItems.length;
  // A tab shows the pin icon iff it carries the data `pinned` flag (global config,
  // user-pinned via right-click, or the first tab when "pin first tab" is on — which
  // is now stored as data). This keeps the visual pin marker identical to the pin
  // state the right-click menu acts on (req #1).
  const isPinnedArr = allItems.map((item) => !!item.pinned);

  const tabItems = allItems.map((item, i) => {
    const isGlobalPinned = i < globalPinned.length;
    const idxInOpen = openTabs.findIndex((tb) => tb.path === item.path);
    const closable = !isGlobalPinned && isClosableNow(item, idxInOpen, total);
    const isPinned = isPinnedArr[i];
    const label = (
      <span
        className="simo-tab-label"
        onMouseDown={(e) => {
          if (!config.middleClickClose || e.button !== 1) return;
          // Always suppress the browser's middle-button autoscroll so the close is
          // never swallowed by it — that was the cause of "needs 2 clicks" (req #4).
          e.preventDefault();
          // Use the known item path directly (no DOM traversal / data-node-key lookup),
          // which removes the timing failure where the first middle-click was ignored.
          closeTab(item.path);
        }}
      >
        {config.showMenuIcon && renderIcon(item.icon)}
        <span className="simo-tab-title">{item.title || titleFor(item.path)}</span>
        {/* Right-aligned group: pin icon (req #1) then close button. The whole group is
            pushed to the far right edge so the pin sits inside the tab, to the left of
            the close button, independent of the title length. */}
        <span className="simo-tab-right">
          {isPinned && (
            <span className="simo-tab-pin" aria-label={t('Pin')} title={t('Pin')}>
              <PushpinFilled />
            </span>
          )}
          {closable && (
            <span
              className="simo-tab-close"
              role="button"
              aria-label={t('Close')}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(item.path);
              }}
            >
              <CloseOutlined />
            </span>
          )}
        </span>
      </span>
    );
    return {
      key: item.path,
      // We render our own close control, so keep antd's built-in remove off.
      closable: false,
      label,
    };
  });

  const ctxMenuItems = useMemo(() => {
    const path = ctx?.path;
    if (!path) return [];
    // Look the tab up in the full item list (not just openTabs) so global-config pinned
    // tabs are found too, and so the pin state matches what the user sees (req #1).
    const idx = allItems.findIndex((tb) => tb.path === path);
    if (idx < 0) return [];
    const item = allItems[idx];
    const isGlobalPinned = idx < globalPinned.length;
    const items: any[] = [];
    // Pin / unpin is a per-user action shown for runtime-pinned tabs (and the pin-first
    // tab). Admin-configured global pinned tabs are fixed and not user-unpinnable, so we
    // skip the toggle there.
    if (!isGlobalPinned) {
      items.push({
        key: item.pinned ? 'unpin' : 'pin',
        label: t(item.pinned ? 'Unpin' : 'Pin'),
        onClick: () => togglePin(path),
      });
    }
    const idxInOpen = openTabs.findIndex((tb) => tb.path === path);
    if (isClosableNow(item, idxInOpen, total)) {
      items.push({ key: 'close', label: t('Close'), onClick: () => closeTab(path) });
    }
    items.push({ type: 'divider' });
    items.push({ key: 'left', label: t('Close left'), onClick: () => closeLeft(path) });
    items.push({ key: 'right', label: t('Close right'), onClick: () => closeRight(path) });
    items.push({ key: 'others', label: t('Close other tabs'), onClick: () => closeOthers(path) });
    items.push({ key: 'all', label: t('Close all tabs'), onClick: () => closeAll() });
    return items;
  }, [ctx, allItems, openTabs, globalPinned, total, t, togglePin, isClosableNow, closeTab, closeLeft, closeRight, closeOthers, closeAll]);

  return (
    <div
      className="simo-multi-tabs-inner"
      data-style={config.style}
      data-close-mode={config.closeButtonMode}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        height: config.tabHeight,
        // Expose the bar height as a CSS var so the tab size can scale with it (req #5).
        ['--simo-bar-h' as any]: `${config.tabHeight}px`,
      }}
      onContextMenu={(e) => {
        if (!config.contextMenu) return;
        const tabEl = (e.target as HTMLElement).closest('.ant-tabs-tab') as HTMLElement | null;
        const path = tabEl?.getAttribute('data-node-key') || activePath || null;
        if (path) {
          e.preventDefault();
          setCtx({ x: e.clientX, y: e.clientY, path });
        }
      }}
    >
      <style>{`
        .simo-multi-tabs .ant-tabs { width: 100%; }
        .simo-multi-tabs .ant-tabs-nav { height: var(--simo-bar-h, 40px); margin: 0; }
        .simo-multi-tabs .ant-tabs-nav-wrap { align-items: center; }
        .simo-multi-tabs .ant-tabs-tab-btn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          max-width: ${config.fixedWidth ? config.fixedTabWidth : config.maxTabWidth}px;
          width: 100%; display: flex; align-items: center; }
        .simo-multi-tabs .ant-tabs-tab {
          ${config.fixedWidth ? `width:${config.fixedTabWidth}px;` : `min-width:${config.minTabWidth}px; max-width:${config.maxTabWidth}px;`}
          /* tab keeps a fixed 5px gap top & bottom from the bar; scales with bar height (req #5) */
          height: calc(var(--simo-bar-h, 40px) - 10px) !important;
          box-sizing: border-box; display: inline-flex; align-items: center;
        }
        /* label fills the whole tab so the close button is always pinned to the right edge,
           independent of the title's length (req #3). The icon uses margin-right (not flex gap)
           so a missing icon reserves NO space — the title starts flush-left (req #1). */
        .simo-multi-tabs .simo-tab-label { display:flex; align-items:center; width:100%; box-sizing:border-box; }
        .simo-multi-tabs .simo-tab-icon { display:inline-flex; align-items:center; justify-content:center; font-size:14px; flex:0 0 auto; margin-right:6px; }
        .simo-multi-tabs .simo-tab-title { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        /* pin + close share a right-aligned group so the pin icon always stays inside the
           tab at the right edge, regardless of the title length (req #1) */
        .simo-multi-tabs .simo-tab-right { flex:0 0 auto; margin-left:auto; display:inline-flex; align-items:center; gap:6px; }
        .simo-multi-tabs .simo-tab-pin { display:inline-flex; align-items:center; justify-content:center; cursor:default;
          color: rgba(0,0,0,0.35); font-size:12px; }
        .simo-multi-tabs .ant-tabs-tab-active .simo-tab-pin { color: #1677ff; }
        .simo-multi-tabs .simo-tab-close { display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
          color: rgba(0,0,0,0.45); font-size:12px; flex:0 0 auto; }
        .simo-multi-tabs .simo-tab-close:hover { color: rgba(0,0,0,0.85); }

        /* style: card — bordered + subtle fill (old-src: TabShape 'card') */
        .simo-multi-tabs [data-style="card"] .ant-tabs-tab {
          border-radius: 6px !important;
          border: 1px solid #f0f0f0 !important;
          background: rgba(0,0,0,0.02) !important;
        }
        .simo-multi-tabs [data-style="card"] .ant-tabs-tab.ant-tabs-tab-active {
          background: #e6f4ff !important;
          border-color: #91caff !important;
        }
        .simo-multi-tabs [data-style="card"] .ant-tabs-tab-active .ant-tabs-tab-btn,
        .simo-multi-tabs [data-style="card"] .ant-tabs-tab-active .simo-tab-icon,
        .simo-multi-tabs [data-style="card"] .ant-tabs-tab-active .simo-tab-close {
          color: #1677ff !important;
        }

        /* style: rounded — customizable corner radius (old-src: TabShape 'round') */
        .simo-multi-tabs [data-style="rounded"] .ant-tabs-tab {
          border-radius: ${config.roundedRadius}px !important;
          border: 1px solid #f0f0f0 !important;
          background: rgba(0,0,0,0.02) !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
        }
        .simo-multi-tabs [data-style="rounded"] .ant-tabs-tab.ant-tabs-tab-active {
          background: #1677ff !important;
          border-color: #1677ff !important;
        }
        .simo-multi-tabs [data-style="rounded"] .ant-tabs-tab-active .ant-tabs-tab-btn,
        .simo-multi-tabs [data-style="rounded"] .ant-tabs-tab-active .simo-tab-icon,
        .simo-multi-tabs [data-style="rounded"] .ant-tabs-tab-active .simo-tab-close {
          color: #fff !important;
        }

        /* style: underline — transparent, active gets a bottom rule (old-src: TabShape 'line') */
        .simo-multi-tabs [data-style="underline"] .ant-tabs-tab {
          border: none !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        .simo-multi-tabs [data-style="underline"] .ant-tabs-tab.ant-tabs-tab-active {
          box-shadow: inset 0 -2px 0 0 #1677ff !important;
        }
        .simo-multi-tabs [data-style="underline"] .ant-tabs-tab-active .ant-tabs-tab-btn,
        .simo-multi-tabs [data-style="underline"] .ant-tabs-tab-active .simo-tab-icon,
        .simo-multi-tabs [data-style="underline"] .ant-tabs-tab-active .simo-tab-close {
          color: #1677ff !important;
        }

        /* close button visibility modes (old-src: closeButtonVisibility) */
        .simo-multi-tabs [data-close-mode="hover"] .ant-tabs-tab:not(:hover) .simo-tab-close { display: none; }
        .simo-multi-tabs [data-close-mode="active"] .ant-tabs-tab:not(.ant-tabs-tab-active) .simo-tab-close { display: none; }
      `}</style>
      <Tabs
        type="editable-card"
        hideAdd
        activeKey={activePath}
        items={tabItems}
        onChange={(key) => go(key)}
        onEdit={() => {}}
      />
      {config.showRefresh && (
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          title={t('Refresh')}
          style={{ marginLeft: 8 }}
          onClick={() => window.location.reload()}
        />
      )}
      {/* Custom right-click menu — portaled to <body> so it escapes the bar's stacking
          context and sits ABOVE the pro-layout menu bar / sider (which pinned it
          underneath before). High z-index guarantees it stays on top (req #2). */}
      {ctx &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: ctx.x,
              top: ctx.y,
              zIndex: 2000,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            borderRadius: 6,
            padding: '4px 0',
            minWidth: 160,
          }}
          onMouseLeave={() => setCtx(null)}
        >
          {ctxMenuItems.map((m: any, i: number) =>
            m.type === 'divider' ? (
              <div key={i} style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
            ) : (
              <div
                key={m.key}
                onClick={() => {
                  m.onClick();
                  setCtx(null);
                }}
                style={{ padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {m.label}
              </div>
            ),
          )}
        </div>,
          document.body,
        )}
    </div>
  );
}
