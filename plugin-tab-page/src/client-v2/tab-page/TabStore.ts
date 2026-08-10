/**
 * Framework-agnostic tab state machine.
 *
 * It owns *only* the list of open tabs and which one is active; navigating and
 * destroying pages is left to the host lane (v1 / v2), which knows how to talk
 * to its own router and page registry. Every mutating method therefore returns
 * a {@link MutationResult} describing what the host still has to do.
 */
import { SESSION_TABS_KEY, TabPageSettings } from '../../constants';
import { getEffectiveSettings, subscribeSettings } from './settings';

export interface TabItem {
  /** Stable identity of the tab — the page uid of the route. */
  key: string;
  /** Full location (pathname + search) last seen for this page. */
  path: string;
  title: string;
  icon?: string;
  /** Explicitly pinned by the user through the context menu. */
  pinned?: boolean;
  /** Monotonic stamp used by the LRU eviction. */
  lastActiveAt: number;
  /** Bumped by "refresh" so the host can force a remount. */
  version: number;
}

export interface TabState {
  tabs: TabItem[];
  activeKey: string;
  /** Key of the very first tab of the session — the "home" tab. */
  homeKey: string;
}

export interface MutationResult {
  /** Tabs that disappeared and whose page may be destroyed. */
  removed: string[];
  /** Where the host should navigate, or `null` when nothing has to change. */
  nextPath: string | null;
}

export interface SyncInput {
  key: string;
  path: string;
  title?: string;
  icon?: string;
}

export interface SyncResult extends MutationResult {
  /** `false` when the new page was refused because the tab limit is reached. */
  accepted: boolean;
}

const EMPTY_STATE: TabState = { tabs: [], activeKey: '', homeKey: '' };

export class TabStore {
  private state: TabState = EMPTY_STATE;
  private listeners = new Set<() => void>();
  private clock = 1;
  private restored = false;
  private unsubscribeSettings?: () => void;

  constructor() {
    // Re-emit whenever the settings change so components re-render with the
    // new size / close-button behaviour without an extra subscription.
    this.unsubscribeSettings = subscribeSettings(() => this.emit());
  }

  /* ---------------- subscription ---------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): TabState => this.state;

  get settings(): TabPageSettings {
    return getEffectiveSettings();
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private commit(next: Partial<TabState>) {
    this.state = { ...this.state, ...next };
    this.persist();
    this.emit();
  }

  /* ---------------- persistence ---------------- */

  /**
   * Restore the tab list saved before the last reload. Only the descriptors
   * are restored — every page is rebuilt from scratch when it is activated.
   */
  restore(): TabState {
    if (this.restored) return this.state;
    this.restored = true;
    if (!this.settings.restoreTabsOnReload || typeof window === 'undefined') {
      return this.state;
    }
    try {
      const raw = window.sessionStorage.getItem(SESSION_TABS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.tabs)) {
        const tabs: TabItem[] = parsed.tabs
          .filter((t: any) => t && typeof t.key === 'string' && typeof t.path === 'string')
          .map((t: any) => ({
            key: t.key,
            path: t.path,
            title: typeof t.title === 'string' ? t.title : '',
            icon: typeof t.icon === 'string' ? t.icon : undefined,
            pinned: !!t.pinned,
            lastActiveAt: this.clock++,
            version: 0,
          }));
        this.state = {
          tabs,
          activeKey: typeof parsed.activeKey === 'string' ? parsed.activeKey : '',
          homeKey: typeof parsed.homeKey === 'string' ? parsed.homeKey : tabs[0]?.key || '',
        };
      }
    } catch {
      /* corrupted payload — start with an empty bar */
    }
    return this.state;
  }

  private persist() {
    if (typeof window === 'undefined' || !this.settings.restoreTabsOnReload) return;
    try {
      window.sessionStorage.setItem(
        SESSION_TABS_KEY,
        JSON.stringify({
          activeKey: this.state.activeKey,
          homeKey: this.state.homeKey,
          tabs: this.state.tabs.map(({ key, path, title, icon, pinned }) => ({ key, path, title, icon, pinned })),
        }),
      );
    } catch {
      /* quota / private mode — persistence is best effort */
    }
  }

  /* ---------------- queries ---------------- */

  find(key: string): TabItem | undefined {
    return this.state.tabs.find((t) => t.key === key);
  }

  indexOf(key: string): number {
    return this.state.tabs.findIndex((t) => t.key === key);
  }

  /** A tab is closable unless it is pinned, the home tab, or the last one. */
  isClosable(key: string): boolean {
    const { tabs, homeKey } = this.state;
    const tab = this.find(key);
    if (!tab) return false;
    if (tab.pinned) return false;
    if (this.settings.pinHomeTab && key === homeKey) return false;
    if (this.settings.keepAtLeastOneTab && tabs.length <= 1) return false;
    return true;
  }

  /** Same as {@link isClosable} but ignores the "keep one tab" rule. */
  private isRemovable(key: string): boolean {
    const tab = this.find(key);
    if (!tab) return false;
    if (tab.pinned) return false;
    if (this.settings.pinHomeTab && key === this.state.homeKey) return false;
    return true;
  }

  /* ---------------- mutations ---------------- */

  /**
   * Called on every route change. Creates the tab if needed, otherwise just
   * refreshes its path / title and marks it active.
   */
  sync(input: SyncInput): SyncResult {
    const { key, path } = input;
    if (!key || !path) {
      return { accepted: true, removed: [], nextPath: null };
    }

    const existing = this.find(key);
    if (existing) {
      const tabs = this.state.tabs.map((t) =>
        t.key === key
          ? {
              ...t,
              path,
              title: input.title || t.title,
              icon: input.icon ?? t.icon,
              lastActiveAt: this.clock++,
            }
          : t,
      );
      this.commit({ tabs, activeKey: key });
      return { accepted: true, removed: [], nextPath: null };
    }

    const removed: string[] = [];
    const { maxTabs, overflowStrategy } = this.settings;
    if (maxTabs > 0 && this.state.tabs.length >= maxTabs) {
      const victim = overflowStrategy === 'closeOldest' ? this.pickEvictionVictim() : undefined;
      if (victim) {
        removed.push(victim);
      } else {
        // Nothing may be evicted — refuse the navigation and stay put.
        const current = this.find(this.state.activeKey);
        return { accepted: false, removed: [], nextPath: current?.path || null };
      }
    }

    const tabs = this.state.tabs
      .filter((t) => !removed.includes(t.key))
      .concat({
        key,
        path,
        title: input.title || '',
        icon: input.icon,
        lastActiveAt: this.clock++,
        version: 0,
      });

    this.commit({
      tabs,
      activeKey: key,
      homeKey: this.state.homeKey || key,
    });
    return { accepted: true, removed, nextPath: null };
  }

  /** Least-recently-active tab that may be thrown away. */
  private pickEvictionVictim(): string | undefined {
    let victim: TabItem | undefined;
    for (const tab of this.state.tabs) {
      if (tab.key === this.state.activeKey) continue;
      if (!this.isRemovable(tab.key)) continue;
      if (!victim || tab.lastActiveAt < victim.lastActiveAt) victim = tab;
    }
    return victim?.key;
  }

  /** Update the label of a tab, e.g. after the menu has been renamed. */
  updateMeta(key: string, meta: { title?: string; icon?: string }) {
    const tab = this.find(key);
    if (!tab) return;
    if ((meta.title === undefined || meta.title === tab.title) && (meta.icon === undefined || meta.icon === tab.icon)) {
      return;
    }
    const tabs = this.state.tabs.map((t) =>
      t.key === key ? { ...t, title: meta.title ?? t.title, icon: meta.icon ?? t.icon } : t,
    );
    this.commit({ tabs });
  }

  activate(key: string): MutationResult {
    const tab = this.find(key);
    if (!tab) return { removed: [], nextPath: null };
    const tabs = this.state.tabs.map((t) => (t.key === key ? { ...t, lastActiveAt: this.clock++ } : t));
    this.commit({ tabs, activeKey: key });
    return { removed: [], nextPath: tab.path };
  }

  close(key: string): MutationResult {
    if (!this.isClosable(key)) return { removed: [], nextPath: null };
    const index = this.indexOf(key);
    let tabs = this.state.tabs.filter((t) => t.key !== key);
    let activeKey = this.state.activeKey;
    let nextPath: string | null = null;
    if (activeKey === key) {
      // Prefer the tab on the right, like every browser does.
      const next = tabs[index] || tabs[index - 1] || tabs[tabs.length - 1];
      activeKey = next?.key || '';
      nextPath = next?.path || null;
      if (next) {
        const stamp = this.clock++;
        tabs = tabs.map((t) => (t.key === next.key ? { ...t, lastActiveAt: stamp } : t));
      }
    }
    // If the closed tab was the home tab (only reachable when `pinHomeTab` is
    // off), hand the role to the first remaining tab so `homeKey` never points
    // at a removed key. An empty bar simply has no home.
    const homeKey = tabs.length ? (this.state.homeKey !== key ? this.state.homeKey : tabs[0].key) : '';
    this.commit({ tabs, activeKey, homeKey });
    return { removed: [key], nextPath };
  }

  private closeMany(keys: string[], keepActive: string): MutationResult {
    const removable = keys.filter((k) => k !== keepActive && this.isRemovable(k));
    if (!removable.length) return { removed: [], nextPath: null };
    const removedSet = new Set(removable);
    const tabs = this.state.tabs.filter((t) => !removedSet.has(t.key));
    let activeKey = this.state.activeKey;
    let nextPath: string | null = null;
    if (removedSet.has(activeKey)) {
      const next = tabs.find((t) => t.key === keepActive) || tabs[tabs.length - 1];
      activeKey = next?.key || '';
      nextPath = next?.path || null;
    }
    // Re-anchor the home tab to the first survivor if the previous home was
    // among the closed set (avoids a dangling `homeKey` reference).
    const previousHome = this.state.homeKey;
    const homeKey = tabs.length ? (tabs.some((t) => t.key === previousHome) ? previousHome : tabs[0].key) : '';
    this.commit({ tabs, activeKey, homeKey });
    return { removed: removable, nextPath };
  }

  closeOthers(key: string): MutationResult {
    return this.closeMany(
      this.state.tabs.map((t) => t.key),
      key,
    );
  }

  closeLeft(key: string): MutationResult {
    const index = this.indexOf(key);
    if (index <= 0) return { removed: [], nextPath: null };
    return this.closeMany(
      this.state.tabs.slice(0, index).map((t) => t.key),
      key,
    );
  }

  closeRight(key: string): MutationResult {
    const index = this.indexOf(key);
    if (index < 0 || index === this.state.tabs.length - 1) return { removed: [], nextPath: null };
    return this.closeMany(
      this.state.tabs.slice(index + 1).map((t) => t.key),
      key,
    );
  }

  /**
   * Close everything that may be closed. Pinned and home tabs always survive;
   * when nothing is pinned the active tab is kept so the user is never left
   * staring at a page that has no tab (unless `keepAtLeastOneTab` is off).
   */
  closeAll(): MutationResult {
    const survivors = this.state.tabs.filter((t) => !this.isRemovable(t.key));
    const keep = survivors[0]?.key || (this.settings.keepAtLeastOneTab ? this.state.activeKey : '');
    return this.closeMany(
      this.state.tabs.map((t) => t.key),
      keep,
    );
  }

  togglePin(key: string) {
    const tabs = this.state.tabs.map((t) => (t.key === key ? { ...t, pinned: !t.pinned } : t));
    this.commit({ tabs });
  }

  /** Bump the version of a tab so the host can force its page to remount. */
  bumpVersion(key: string) {
    const tabs = this.state.tabs.map((t) => (t.key === key ? { ...t, version: t.version + 1 } : t));
    this.commit({ tabs });
  }

  /** Drag & drop reordering. */
  move(fromKey: string, toKey: string) {
    const from = this.indexOf(fromKey);
    const to = this.indexOf(toKey);
    if (from < 0 || to < 0 || from === to) return;
    const tabs = this.state.tabs.slice();
    const [moved] = tabs.splice(from, 1);
    tabs.splice(to, 0, moved);
    this.commit({ tabs });
  }

  /** Drop everything — used when the tab mode is switched off at runtime. */
  reset() {
    this.state = EMPTY_STATE;
    this.restored = false;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(SESSION_TABS_KEY);
      } catch {
        /* ignore */
      }
    }
    this.emit();
  }

  destroy() {
    this.unsubscribeSettings?.();
    this.listeners.clear();
  }
}

/** Process-wide singleton — v1 and v2 never run in the same page load. */
export const tabStore = new TabStore();
