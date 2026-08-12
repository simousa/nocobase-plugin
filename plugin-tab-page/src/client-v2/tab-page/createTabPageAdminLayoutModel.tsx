/**
 * Factory that builds the tab-page `AdminLayoutModel` subclass.
 *
 * The admin layout host model is referenced by **name** (`AdminLayoutModel`)
 * from the layout definition, and `FlowEngine.registerModels()` overwrites
 * any previously registered class with the same key. By overriding it we turn
 * the layout host into a tab strip without patching a single line of core code
 * — and when the plugin is disabled the bundle is never loaded, so the stock
 * full-page navigation is back untouched.
 *
 * The same behaviour must run in **both** client lanes:
 *
 * - v2 registers the v2 `AdminLayoutModel` (from `@nocobase/client-v2`) under
 *   that name. We pass that class straight in.
 * - v1 registers `AdminLayoutModelV1` (which extends the v2 base) under the
 *   same name. `AdminLayoutModelV1` is not part of the public export surface,
 *   so the v1 lane fetches the *actually registered* class at runtime via
 *   `flowEngine.getModelClass('AdminLayoutModel')` and passes it here. This way
 *   the v1-specific `render()` (legacy menu shell) is preserved while our tab
 *   bar is still injected.
 *
 * Two hooks are enough to build the strip on top of the existing shell:
 *
 * - `syncLayoutRoute()` is called by the layout on *every* route change and
 *   already resolves the pathname into `{ type: 'page', pageUid, pathname }` —
 *   exactly the identity a tab needs.
 * - `setLayoutContentElement()` receives the content-area DOM node. That node
 *   is `display:flex; flex-direction:column`, so portalling the bar into it
 *   with `order: -1` puts it above the page without touching the core markup.
 *
 * Page *state* is preserved by NocoBase itself: the content area wraps pages in
 * `<KeepAlive uid={pageUid}>`, so switching tabs only hides/shows an already
 * mounted subtree.
 */
import { css } from '@emotion/css';
import { Icon } from '@nocobase/client-v2';
import type { AdminLayoutModel as AdminLayoutModelType, LayoutRouteLike, LayoutRouteMatch } from '@nocobase/client-v2';
import { message } from 'antd';
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PLUGIN_NAME } from '../../constants';
import { useTabSettings, useTabState } from './hooks';
import { getEffectiveSettings } from './settings';
import { TabBar, type TabController } from './TabBar';
import { type MutationResult, tabStore } from './TabStore';

/**
 * The tab bar is pinned directly below the top navigation bar. It remains in
 * the application root so it spans both the sider and content area; the
 * matching layout regions receive the bar height as top padding so no content
 * is covered in the vertical direction.
 *
 * z-index hierarchy INSIDE `#nocobase-app-container` (all share the same
 * stacking context):
 *
 *   Popups (Drawer/Modal)   1001+ 
 *   Sider collapsed button   200
 *   Header (nav bar)         101
 *   Page content (PageComp)    4 
 *   Sider / content area       0 
 *
 */
const slotClass = css`
  position: fixed;
  top: var(--nb-header-height, 48px);
  left: 0;
  right: 0;
  z-index: 200;
`;
const APP_CONTAINER_SELECTOR = '#nocobase-app-container';
// The element that should carry the `calc(100dvh - var(--nb-header-height))`
// budget once the fixed tab bar is injected. It is the slot's parent (the
// "layer-above" content wrapper) — see the `TabBarPortal` effect below.
const CONTENT_PARENT_SELECTOR = '.ant-layout-content.ant-pro-layout-content.ant-pro-layout-has-header';
const SIDER_SELECTOR = '.ant-layout-sider';

/** Minimal surface the (lane-agnostic) tab bar needs from the host model. */
interface TabHostProvider {
  subscribeTabHost(listener: () => void): () => void;
  getTabHost(): HTMLElement | null;
  getTabController(): TabController;
}

interface TabBarPortalProps {
  model: TabHostProvider;
}

const TabBarPortal: React.FC<TabBarPortalProps> = ({ model }) => {
  const settings = useTabSettings();
  // Subscribe to the active tab so the portal re-renders on route changes.
  const { activeKey } = useTabState();
  const barRef = React.useRef<HTMLDivElement>(null);

  // ── Resolve the portal target: #nocobase-app-container ──────────────
  const resolveTarget = React.useCallback((): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    const host = model.getTabHost();
    return host?.closest<HTMLElement>(APP_CONTAINER_SELECTOR) || document.querySelector<HTMLElement>(APP_CONTAINER_SELECTOR);
  }, [model]);

  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);

  // Initial resolution + retry interval
  React.useEffect(() => {
    const target = resolveTarget();
    if (target) {
      setPortalTarget(target);
      return;
    }
    // Container not ready yet — poll until it appears (max 10 s)
    const interval = setInterval(() => {
      const t = resolveTarget();
      if (t) {
        setPortalTarget(t);
        clearInterval(interval);
      }
    }, 100);
    const timeout = setTimeout(() => clearInterval(interval), 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [resolveTarget]);

  // Also re-resolve when the host element changes (e.g. after navigation
  // that causes the content element to be re-created).
  React.useEffect(() => {
    return model.subscribeTabHost(() => {
      const t = resolveTarget();
      if (t) setPortalTarget(t);
    });
  }, [model, resolveTarget]);

  useEffect(() => {
    if (!settings.enabled || !portalTarget) return;

    // The slot the core hands us (`.nb-subpages-slot-without-header-and-side`)
    // is the element that carries the full `height: calc(100dvh -
    // var(--nb-header-height))`. Our fixed tab bar is portaled just under the
    // header and overlaps that slot's top edge. Previously we added
    // `padding-top` to the slot itself, but because the slot has a *fixed*
    // height the padding only squeezed its scrollable child *under* the bar —
    // i.e. the content was occluded in the y-direction.
    //
    // Fix (per the reported bug): move the height budget up one level. Give the
    // wrapping `.ant-layout-content.ant-pro-layout-content.ant-pro-layout-has-header`
    // the `calc(100dvh - var(--nb-header-height))` height plus the bar's
    // `padding-top`, and let the slot simply fill its parent (`height: 100%`).
    // The slot then starts *below* the fixed bar and the content is never
    // covered.
    const slot = model.getTabHost();
    const contentParent =
      slot?.closest<HTMLElement>(CONTENT_PARENT_SELECTOR) || slot?.parentElement || null;
    const siders = Array.from(portalTarget.querySelectorAll<HTMLElement>(SIDER_SELECTOR));

    // Capture the original inline styles the first time we touch each element,
    // so the effect can be torn down cleanly. This is pure DOM compensation —
    // the plugin never mutates NocoBase core source. Capturing is per-element
    // and lazy so elements that mount late (the sider collapse button) are
    // still handled and restored correctly.
    const capturedEls = new Set<HTMLElement>();
    const originals: Array<{ el: HTMLElement; props: Record<string, string> }> = [];
    const capture = (el: HTMLElement, props: string[]) => {
      if (capturedEls.has(el)) return;
      const prev: Record<string, string> = {};
      props.forEach((p) => (prev[p] = el.style.getPropertyValue(p)));
      originals.push({ el, props: prev });
      capturedEls.add(el);
    };

    // Watcher that re-runs `sync` when the sider collapse button appears. It is
    // torn down as soon as the button has been positioned (or by the safety
    // timeout below), so it never lingers.
    let buttonObserver: MutationObserver | null = null;

    const sync = () => {
      const height = barRef.current?.offsetHeight || 0;
      if (!height) return;

      if (contentParent) {
        capture(contentParent, ['height', 'padding-top', 'box-sizing']);
        // The `calc(100dvh - var(--nb-header-height))` budget now lives on the
        // parent; `padding-top` reserves room for the fixed tab bar.
        contentParent.style.height = 'calc(100dvh - var(--nb-header-height))';
        contentParent.style.paddingTop = `${height}px`;
        contentParent.style.boxSizing = 'border-box';
      }
      if (slot) {
        capture(slot, ['height', 'padding-top']);
        // Slot no longer carries its own fixed height — it fills the (already
        // height-budgeted + padded) parent, so it starts below the tab bar.
        slot.style.height = '100%';
        slot.style.paddingTop = '';
      }
      siders.forEach((s) => {
        capture(s, ['padding-top']);
        s.style.paddingTop = `${height}px`;
      });

      // The sider collapse button (`.ant-pro-sider-collapsed-button`) is pinned
      // by core at `top: 64px`, which lands it on top of the tab bar. Push it
      // down by the bar height so its top aligns with the bottom of the bar and
      // nothing is occluded. Its `top` is relative to the full-height sider, so
      // clearing the header *plus* the bar height places it just under the bar.
      const collapsedButton = portalTarget.querySelector<HTMLElement>('.ant-pro-sider-collapsed-button');
      if (collapsedButton) {
        capture(collapsedButton, ['top']);
        collapsedButton.style.top = `calc(var(--nb-header-height) + ${height}px)`;
        buttonObserver?.disconnect();
        buttonObserver = null;
      }
    };

    sync();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    if (barRef.current) observer?.observe(barRef.current);

    // The collapse button may mount after this effect first runs — watch the
    // container for it, then stop watching once it has been positioned.
    buttonObserver =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(() => sync()) : null;
    buttonObserver?.observe(portalTarget, { childList: true, subtree: true });
    // Safety net: stop watching after 10s even if it never appears.
    const buttonWatchTimeout = setTimeout(() => {
      buttonObserver?.disconnect();
      buttonObserver = null;
    }, 10000);

    return () => {
      observer?.disconnect();
      buttonObserver?.disconnect();
      clearTimeout(buttonWatchTimeout);
      originals.forEach(({ el, props }) => {
        Object.entries(props).forEach(([p, v]) => {
          if (v) el.style.setProperty(p, v);
          else el.style.removeProperty(p);
        });
      });
    };
  }, [activeKey, model, portalTarget, settings.enabled]);

  if (!settings.enabled || !portalTarget) {
    return null;
  }

  return createPortal(
    <div ref={barRef} className={slotClass} data-simo-tab-page-slot="true">
      <TabBar controller={model.getTabController()} IconComponent={Icon} />
    </div>,
    portalTarget,
  );
};

/**
 * Build the tab-page `AdminLayoutModel` subclass.
 *
 * @param Base The currently-registered admin layout model class (v2
 *   `AdminLayoutModel` in the v2 lane, `AdminLayoutModelV1` in the v1 lane).
 *
 * The return type is `any` on purpose: this function returns a *class
 * expression*, and TypeScript's declaration emitter refuses to emit `.d.ts`
 * for an exported class expression that (transitively) has private/protected
 * members — including the many inherited ones from the flow base. Anchoring
 * the return type to `any` keeps the class expression's type out of the
 * exported surface, so the `.d.ts` for this module stays trivial and the
 * emitter is happy. The runtime class is unaffected.
 */
export function createTabPageAdminLayoutModel(Base: typeof AdminLayoutModelType): any {
  return class TabPageAdminLayoutModel extends Base {
    tabHostElement: HTMLElement | null = null;
    tabHostListeners?: Set<() => void>;
    tabController?: TabController;
    unsubscribeRoutes?: () => void;

    /* ------------------------------------------------------------------ *
     * Content-area element — tracked by hand instead of through the
     * `layoutContentElement` context property, which is deliberately
     * non-observable (`cache: false` getter) in the base class.
     * ------------------------------------------------------------------ */

    subscribeTabHost = (listener: () => void): (() => void) => {
      if (!this.tabHostListeners) {
        this.tabHostListeners = new Set();
      }
      this.tabHostListeners.add(listener);
      return () => {
        this.tabHostListeners?.delete(listener);
      };
    };

    getTabHost = (): HTMLElement | null => this.tabHostElement;

    setLayoutContentElement(element: HTMLElement | null) {
      super.setLayoutContentElement(element);
      if (this.tabHostElement === element) return;
      this.tabHostElement = element;
      this.tabHostListeners?.forEach((fn) => fn());
    }

    /* ------------------------------------------------------------------ *
     * Route → tab
     * ------------------------------------------------------------------ */

    syncLayoutRoute(routeLike: LayoutRouteLike): LayoutRouteMatch {
      const match = super.syncLayoutRoute(routeLike);
      try {
        this.trackRouteAsTab(routeLike, match);
      } catch (err) {
        console.error('[@simo/plugin-tab-page] failed to track the current route', err);
      }
      return match;
    }

    trackRouteAsTab(routeLike: LayoutRouteLike, match: LayoutRouteMatch | null) {
      if (!getEffectiveSettings().enabled) return;

      const pathname = match?.pathname || routeLike?.pathname || '';
      // Prefer the framework-resolved pageUid (the page's schema uid) — it is the
      // most stable identity and matches what KeepAlive / routeRepository use.
      let key = match?.type === 'page' && match.pageUid ? match.pageUid : '';
      // Fallback: some admin content routes resolve to `root`/`notFound` instead
      // of `page` (e.g. the settings center, whose nested paths like
      // `/admin/settings/...` are not "standard" layout relative paths). In that
      // case derive the tab key from the pathname itself: the first segment after
      // `/admin/` is the page id. This makes a new tab appear for every distinct
      // menu the user opens, which is the expected browser-tab behaviour, even
      // when the framework's own route resolver disagrees about the match type.
      if (!key) {
        key = this.resolveTabKeyFromPath(pathname);
      }
      if (!key) return;

      const meta = this.readRouteMeta(key);
      const result = tabStore.sync({
        key,
        path: pathname,
        title: meta.title,
        icon: meta.icon,
      });

      if (!result.accepted) {
        // The tab limit is reached and nothing may be evicted — bounce back to
        // the tab the user was on instead of silently opening an 11th page.
        if (result.nextPath && result.nextPath !== pathname) {
          this.navigateTo(result.nextPath, true);
        }
        // Tell the user *why* their click did not open a new page; otherwise the
        // silent bounce-back looks like a broken menu. The two strings are
        // already present in the locale files but were never wired up before.
        this.notifyTabLimitReached();
        return;
      }

      this.disposePages(result.removed);
    }

    /**
     * Extract a stable tab key from a pathname when the framework's route
     * resolver did not yield a `page` match.
     *
     * Accepts both `/v/admin/{key}/...` (v2 runtime, `/v` basename) and
     * `/admin/{key}/...` (v1 / no basename). The first real segment after the
     * admin base is the page id. Segments that are page-internal navigation
     * keywords (`view`, `tab`, `opts`, …) are ignored so they never spawn a
     * new tab — they belong to the currently open page.
     */
    private resolveTabKeyFromPath(pathname: string): string {
      if (!pathname) return '';
      const m = pathname.match(/\/(?:v\/)?admin\/([^/?#]+)/);
      if (!m) return '';
      let seg: string;
      try {
        seg = decodeURIComponent(m[1]);
      } catch {
        seg = m[1];
      }
      if (!seg) return '';
      // These are page-internal navigation segments, not page ids.
      if (['view', 'tab', 'opts', 'filterbytk', 'sourceid'].includes(seg)) return '';
      return seg;
    }

    /**
     * Show the "tab limit reached" notice. Uses the runtime i18n instance
     * (no React hook is available from inside a flow model) and degrades
     * gracefully to the raw English key when i18n is not ready yet.
     */
    private notifyTabLimitReached() {
      try {
        const i18n: any = (this.flowEngine.context as any)?.i18n;
        const t: (k: string) => string =
          typeof i18n?.t === 'function' ? (k: string) => i18n.t(k, { ns: [PLUGIN_NAME, 'client'] }) : (k: string) => k;
        message.warning(`${t('Tab limit reached')} — ${t('Close a tab before opening a new page.')}`);
      } catch {
        /* antd static `message` may not be mounted in some test envs — ignore */
      }
    }

    /** Title / icon of a page, straight from the desktop route tree. */
    readRouteMeta(pageUid: string): { title?: string; icon?: string } {
      const route: any = this.getCurrentRouteByPageUid(pageUid) || {};
      return {
        title: typeof route.title === 'string' && route.title ? route.title : undefined,
        icon: typeof route.icon === 'string' && route.icon ? route.icon : undefined,
      };
    }

    /* ------------------------------------------------------------------ *
     * Lifecycle
     * ------------------------------------------------------------------ */

    onMount(): void {
      super.onMount();
      this.watchRouteRepository();
    }

    onUnmount(): void {
      this.unsubscribeRoutes?.();
      this.unsubscribeRoutes = undefined;
      this.tabHostListeners?.clear();
      this.tabHostElement = null;
      super.onUnmount();
    }

    /**
     * Menu titles arrive asynchronously (and change when a menu is renamed), so
     * the labels of the already open tabs are refreshed whenever the desktop
     * route cache changes.
     */
    watchRouteRepository() {
      const repository: any = (this.flowEngine.context as any).routeRepository;
      if (!repository?.subscribe) return;
      this.unsubscribeRoutes = repository.subscribe(() => {
        tabStore.getSnapshot().tabs.forEach((tab) => {
          const meta = this.readRouteMeta(tab.key);
          if (meta.title || meta.icon) {
            tabStore.updateMeta(tab.key, meta);
          }
        });
      });
    }

    /* ------------------------------------------------------------------ *
     * Navigation & page disposal
     * ------------------------------------------------------------------ */

    /**
     * Navigation is deferred to a microtask: `syncLayoutRoute` runs inside the
     * router's own effect, and navigating synchronously from there makes
     * react-router warn about updating a router while it is rendering.
     */
    navigateTo(path: string, replace = false) {
      const router: any = this.flowEngine.context.router;
      if (!router?.navigate || !path) return;
      Promise.resolve()
        .then(() => router.navigate(path, replace ? { replace: true } : undefined))
        .catch((err: unknown) => {
          console.error('[@simo/plugin-tab-page] navigation failed', path, err);
        });
    }

    applyMutation(result: MutationResult) {
      this.disposePages(result.removed);
      if (result.nextPath) {
        this.navigateTo(result.nextPath);
      }
    }

    disposePages(keys: string[]) {
      if (!keys?.length || !getEffectiveSettings().destroyOnClose) return;
      keys.forEach((key) => this.discardPage(key));
    }

    /**
     * Destroy the view models of a page while keeping its route runtime
     * registered.
     *
     * `unregisterRoutePage()` is deliberately **not** used: the page's React
     * subtree is still mounted inside `<KeepAlive>`, and dropping the runtime
     * would leave that subtree pointing at destroyed models. `cleanupPage()`
     * frees the models and resets the runtime, so navigating back to the page
     * rebuilds it from scratch — exactly what a closed tab should do.
     */
    discardPage(pageUid: string) {
      try {
        (this.getCoordinator() as any)?.cleanupPage?.(pageUid);
      } catch (err) {
        console.error('[@simo/plugin-tab-page] failed to discard page', pageUid, err);
      }
    }

    /**
     * Re-run the page's data flows without rebuilding it, by replaying the
     * deactivate → activate transition the layout performs when tabs are
     * switched (`activate(true)` = force refresh).
     */
    reactivatePage(pageUid: string) {
      try {
        const coordinator: any = this.getCoordinator();
        coordinator?.syncPageMeta?.(pageUid, { active: false });
        coordinator?.syncPageMeta?.(pageUid, { active: true });
      } catch (err) {
        console.error('[@simo/plugin-tab-page] failed to refresh page', pageUid, err);
      }
    }

    /* ------------------------------------------------------------------ *
     * Controller handed to the (lane-agnostic) tab bar
     * ------------------------------------------------------------------ */

    getTabController(): TabController {
      if (!this.tabController) {
        this.tabController = {
          activate: (key) => this.applyMutation(tabStore.activate(key)),
          close: (key) => this.applyMutation(tabStore.close(key)),
          closeOthers: (key) => this.applyMutation(tabStore.closeOthers(key)),
          closeLeft: (key) => this.applyMutation(tabStore.closeLeft(key)),
          closeRight: (key) => this.applyMutation(tabStore.closeRight(key)),
          closeAll: () => this.applyMutation(tabStore.closeAll()),
          togglePin: (key) => tabStore.togglePin(key),
          isClosable: (key) => tabStore.isClosable(key),
          refresh: (key) => {
            tabStore.bumpVersion(key);
            if (tabStore.getSnapshot().activeKey === key) {
              this.reactivatePage(key);
              return;
            }
            // Refreshing a background tab: throw its models away and let the
            // navigation rebuild them.
            this.discardPage(key);
            this.applyMutation(tabStore.activate(key));
          },
        };
      }
      return this.tabController;
    }

    render() {
      return (
        <>
          {super.render()}
          <TabBarPortal model={this} />
        </>
      );
    }
  };
}

export default createTabPageAdminLayoutModel;
