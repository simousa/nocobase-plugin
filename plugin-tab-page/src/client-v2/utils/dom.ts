import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MultiTabsBar } from '../components/MultiTabsBar';
import { getBarPosition } from './config';
import type { BarPosition } from '../types';

const TAB_BAR_CLASS = 'simo-multi-tabs';

export interface MountProps {
  apiClient: any;
  navigate: (to: string) => void;
  getBasename: () => string;
  t: (s: string) => string;
  /** Resolve the current portal (门户) key; used to scope & isolate tabs per portal. */
  getPortalKey?: () => string;
}

interface Anchor {
  parent: HTMLElement;
  reference: Node | null;
  /** When true the bar lives inside the scrolling content column (right of the sidebar). */
  sticky: boolean;
}

/**
 * NocoBase v2 admin shell (pro-layout, `layout="mix"`):
 *   .ant-pro-layout
 *     .ant-layout.ant-layout-has-sider   (flex row: [.ant-layout-sider, .ant-pro-layout-container])
 *       .ant-layout-sider
 *       .ant-pro-layout-container
 *         .ant-layout-header.ant-pro-layout-header   (top navigation bar)
 *         .ant-pro-layout-content / page
 *
 * IMPORTANT: the top navigation bar is rendered with `position: fixed; top: 0`
 * and `z-index: 100`, so it overlays the very top of the viewport. Any element we
 * place at the top of the shell therefore collides with it in the Z axis (the bar
 * would cover the nav, or vice-versa). That was the previous bug.
 *
 * Fix:
 *  - 'page'    : the bar is rendered `position: fixed; top: <navHeight>` so it sits
 *                directly *below* the fixed nav, full width (above the sidebar). The
 *                [sidebar | content] row is already offset below the fixed nav by an
 *                in-flow spacer, so we only need to push it down by the bar's own
 *                height. The sidebar, however, is itself `position: fixed` (mix layout:
 *                `.ant-pro-sider-fixed-mix`), so its `top` is shifted down by the bar
 *                height and its `height` trimmed to reach the viewport bottom — keeping
 *                it aligned with the content column, beneath the floating bar.
 *  - 'sidebar' : the bar is inserted inside .ant-pro-layout-container, right after the
 *                nav header, to the right of the sidebar, and sticks below the nav.
 */
function findAnchor(barPosition: BarPosition): Anchor | null {
  const row = document.querySelector('.ant-layout.ant-layout-has-sider') as HTMLElement | null;
  const outer = document.querySelector('.ant-pro-layout') as HTMLElement | null;

  if (barPosition === 'sidebar') {
    const container = document.querySelector('.ant-pro-layout-container') as HTMLElement | null;
    const parent = container || row || outer;
    if (!parent) return null;
    const header = parent.querySelector('.ant-layout-header, .ant-pro-layout-header');
    const reference = header ? header.nextSibling : parent.firstChild;
    return { parent, reference, sticky: true };
  }

  // 'page'
  if (!row || !outer) return null;
  return { parent: outer, reference: row, sticky: false };
}

/** Height of the fixed top navigation bar, in pixels (0 when not found). */
function getNavHeight(): number {
  const nav =
    (document.querySelector('.ant-pro-layout-header') as HTMLElement | null) ||
    (document.querySelector('.ant-layout-header') as HTMLElement | null);
  if (!nav) return 0;
  const h = nav.getBoundingClientRect().height || nav.offsetHeight;
  return h || 0;
}

let historyPatched = false;

/** Patch history so any navigation (including menu clicks) notifies listeners. */
export function patchHistory(onChange: () => void) {
  if (historyPatched) return;
  historyPatched = true;
  const wrap = (method: 'pushState' | 'replaceState') => {
    const original = window.history[method];
    // @ts-ignore - preserving original signature
    window.history[method] = function (...args: any[]) {
      const result = original.apply(this, args);
      onChange();
      return result;
    };
  };
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', onChange);
}

/* ---------------- page-mode fix: float the bar below the fixed nav ---------------- */

let fixedRow: HTMLElement | null = null;
let fixedRowMarginTop = '';

// The sidebar in `mix` layout is `position: fixed; top: <navH>; height: calc(100% - <navH>)`
// (see .ant-pro-sider-fixed-mix). A fixed element ignores the row's margin, so we must
// shift it down by the bar height ourselves and shrink its height to still reach the bottom.
let fixedSider: HTMLElement | null = null;
let fixedSiderTop = '';
let fixedSiderHeight = '';
let fixedSiderBaseTop = 0;

// The collapse toggle (.ant-pro-sider-collapsed-button) is NOT positioned relative to the fixed
// sider (so `top: 0` does NOT align it with the sider). We align it by measuring both rects and
// nudging its `top` by the delta — only the Y axis changes, X (`right: -13px`) stays untouched.
let fixedBtn: HTMLElement | null = null;
let fixedBtnTop = '';

/**
 * Push the [sidebar | content] row down by exactly the bar's height.
 *
 * The top navigation bar is `position: fixed`, and pro-layout already reserves its
 * space with an in-flow spacer header (height = navH) inside the container — so the
 * body is *already* offset below the nav. We therefore only need to add the bar's own
 * height, which places the row's content (sider + page) exactly below the floating
 * bar (top: navH, height: barH  ->  content starts at navH + barH).
 */
const applyPageFix = (barHeight: number) => {
  const row = document.querySelector('.ant-layout.ant-layout-has-sider') as HTMLElement | null;
  if (!row) return;

  if (fixedRow !== row) {
    // First time for this row: capture its original margin.
    restorePageFix();
    fixedRow = row;
    fixedRowMarginTop = row.style.marginTop;
  }

  const base = parseFloat(fixedRowMarginTop) || 0;
  row.style.marginTop = base + barHeight + 'px';

  const sider = document.querySelector('.ant-pro-sider-fixed-mix') as HTMLElement | null;
  if (!sider) return;
  if (fixedSider !== sider) {
    fixedSider = sider;
    fixedSiderTop = sider.style.top;
    fixedSiderHeight = sider.style.height;
    fixedSiderBaseTop = parseFloat(getComputedStyle(sider).top) || 0;
  }
  const top = fixedSiderBaseTop + barHeight;
  sider.style.top = `${top}px`;
  sider.style.height = `calc(100% - ${top}px)`;

  // Collapse toggle: align its TOP with the (already shifted) sider's top so it sits on the same
  // horizontal line as the sider top / tab-bar bottom. We only change the Y axis (the `top`
  // value); the X axis (`right: -13px`) is left exactly as pro-layout set it. Because the button's
  // containing block is NOT the fixed sider, we align via rectangles + a delta nudge — this is
  // robust to re-application (idempotent: once aligned, dy === 0).
  const btn = document.querySelector('.ant-pro-sider-collapsed-button') as HTMLElement | null;
  if (btn) {
    if (fixedBtn !== btn) {
      fixedBtn = btn;
      fixedBtnTop = btn.style.top;
    }
    const siderRect = sider.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const dy = siderRect.top - btnRect.top; // >0 => move button down to meet the sider top
    if (dy !== 0) {
      const currentTop = parseFloat(getComputedStyle(btn).top) || 0;
      btn.style.top = `${currentTop + dy}px`;
    }
  }
};

const restorePageFix = () => {
  if (fixedRow) {
    fixedRow.style.marginTop = fixedRowMarginTop;
  }
  if (fixedSider) {
    fixedSider.style.top = fixedSiderTop;
    fixedSider.style.height = fixedSiderHeight;
  }
  if (fixedBtn) {
    fixedBtn.style.top = fixedBtnTop;
  }
  fixedRow = null;
  fixedRowMarginTop = '';
  fixedSider = null;
  fixedSiderTop = '';
  fixedSiderHeight = '';
  fixedSiderBaseTop = 0;
  fixedBtn = null;
  fixedBtnTop = '';
};

export function mountMultiTabs(props: MountProps): () => void {
  let root: Root | null = null;
  let container: HTMLElement | null = null;
  let mountedParent: HTMLElement | null = null;
  let mountedSticky = false;
  let measuredBarHeight = 40;
  let refineScheduled = false;
  // Watches the bar's own height so the page-mode offset (sidebar/header shift) is
  // re-applied whenever the bar grows/shrinks — e.g. after the user changes tabHeight
  // in settings (req #1).
  let ro: ResizeObserver | null = null;

  /** Re-measure the bar's real height and re-apply the floating offset (after render / config change). */
  const scheduleRefine = () => {
    if (refineScheduled) return;
    refineScheduled = true;
    requestAnimationFrame(() => {
      refineScheduled = false;
      if (!container) return;
      const navH = getNavHeight();
      container.style.top = `${navH}px`;
      if (getBarPosition() !== 'page') return;
      measuredBarHeight = container.offsetHeight || measuredBarHeight;
      applyPageFix(measuredBarHeight);
    });
  };

  const ensureMount = () => {
    const barPosition = getBarPosition();
    const anchor = findAnchor(barPosition);
    if (!anchor) return;

    // Reposition: if the parent or sticky mode changed, tear down and rebuild.
    if (container && (mountedParent !== anchor.parent || mountedSticky !== anchor.sticky)) {
      try {
        root?.unmount();
      } catch {
        /* noop */
      }
      restorePageFix();
      ro?.disconnect();
      ro = null;
      container.remove();
      container = null;
      root = null;
      mountedParent = null;
      mountedSticky = false;
    }

    if (container && mountedParent === anchor.parent && mountedSticky === anchor.sticky) {
      // Already mounted at the correct spot — keep the offset / nav-alignment fresh
      // (the nav may have just appeared, or its height may have changed).
      const navH = getNavHeight();
      container.style.top = `${navH}px`;
      if (barPosition === 'page') applyPageFix(measuredBarHeight);
      return;
    }

    const navH = getNavHeight();

    if (barPosition === 'page') {
      applyPageFix(measuredBarHeight);
    } else {
      restorePageFix();
    }

    container = document.createElement('div');
    container.className = TAB_BAR_CLASS;
    const positionStyle =
      barPosition === 'page'
        ? `position:fixed;top:${navH}px;left:0;right:0;z-index:99;`
        : `position:sticky;top:${navH}px;z-index:99;`;
    container.style.cssText =
      positionStyle +
      'width:100%;display:flex;align-items:center;flex:0 0 auto;' +
      'background:#fff;border-bottom:1px solid #f0f0f0;min-height:28px;padding:0 8px;box-sizing:border-box;';

    anchor.parent.insertBefore(container, anchor.reference);
    mountedParent = anchor.parent;
    mountedSticky = anchor.sticky;
    root = createRoot(container);
    root.render(React.createElement(MultiTabsBar, props));

    if (barPosition === 'page') scheduleRefine();

    // Whenever the bar's rendered height changes (config edit, font load, window
    // resize), re-apply the page-mode offset so the sidebar/header stay aligned with
    // the bar's bottom (req #1). A ResizeObserver catches the post-render height
    // change that the one-shot scheduleRefine at config-change time would otherwise miss.
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => scheduleRefine());
      ro.observe(container);
    }
  };

  const observer = new MutationObserver(() => ensureMount());
  observer.observe(document.body, { childList: true, subtree: true });
  ensureMount();

  // Reposition when the bar position or config changes.
  const onConfigChanged = () => {
    ensureMount();
    scheduleRefine();
  };
  const onBarPositionChanged = () => {
    ensureMount();
    scheduleRefine();
  };
  window.addEventListener('simo:config-changed', onConfigChanged);
  window.addEventListener('simo:bar-position-changed', onBarPositionChanged);

  return () => {
    ro?.disconnect();
    observer.disconnect();
    window.removeEventListener('simo:config-changed', onConfigChanged);
    window.removeEventListener('simo:bar-position-changed', onBarPositionChanged);
    restorePageFix();
    try {
      root?.unmount();
    } catch {
      /* noop */
    }
    container?.remove();
  };
}
