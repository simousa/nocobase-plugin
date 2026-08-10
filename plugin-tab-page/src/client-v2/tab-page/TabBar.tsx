/**
 * The tab strip itself.
 *
 * IMPORTANT — this component is rendered by **both** client lanes (the legacy
 * `/admin` shell and the v2 FlowEngine shell), so it may only import packages
 * that the plugin build externalises for both: react, antd, @ant-design/icons,
 * @emotion/css and react-i18next. Everything host-specific (the icon registry,
 * navigation, page destruction) arrives through {@link TabBarProps}.
 */
import {
  CloseOutlined,
  LeftOutlined,
  PushpinFilled,
  PushpinOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { css, cx } from '@emotion/css';
import { Dropdown, theme } from 'antd';
import type { MenuProps } from 'antd';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TAB_SIZE_METRICS } from '../../constants';
import { useTabSettings, useTabState, useTabT } from './hooks';
import type { TabItem } from './TabStore';

export interface TabController {
  activate(key: string): void;
  close(key: string): void;
  closeOthers(key: string): void;
  closeLeft(key: string): void;
  closeRight(key: string): void;
  closeAll(): void;
  togglePin(key: string): void;
  refresh(key: string): void;
  isClosable(key: string): boolean;
}

export interface TabBarProps {
  controller: TabController;
  /**
   * The host's icon component (`Icon` from `@nocobase/client` for the v1 lane,
   * from `@nocobase/client-v2` for the v2 lane). Optional — without it tabs
   * simply render without icons.
   */
  IconComponent?: React.ComponentType<any>;
}

const scrollStepPx = 200;

export const TabBar: React.FC<TabBarProps> = ({ controller, IconComponent }) => {
  const settings = useTabSettings();
  const { tabs, activeKey, homeKey } = useTabState();
  const t = useTabT();
  const { token } = theme.useToken();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const metrics = TAB_SIZE_METRICS[settings.tabSize] || TAB_SIZE_METRICS.middle;

  /* ---------------- overflow handling ---------------- */

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflowing(el.scrollWidth - el.clientWidth > 2);
  }, []);

  useLayoutEffect(measure, [measure, tabs.length, settings.tabMaxWidth, settings.tabSize]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Keep the active tab visible when it is opened from the menu.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !activeKey) return;
    const nodes = el.querySelectorAll<HTMLElement>('[data-tab-key]');
    for (const node of Array.from(nodes)) {
      if (node.dataset.tabKey === activeKey) {
        node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        break;
      }
    }
  }, [activeKey]);

  const scrollBy = (delta: number) => scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    el.scrollLeft += event.deltaY;
  }, []);

  /* ---------------- styles ---------------- */

  const styles = useMemo(() => {
    const shape = settings.tabShape;
    const radius = shape === 'round' ? metrics.height / 2 : token.borderRadius;
    return {
      bar: css`
        display: flex;
        align-items: center;
        flex: none;
        gap: 4px;
        padding: 4px ${token.paddingXS}px;
        background: ${token.colorBgContainer};
        border-bottom: 1px solid ${token.colorBorderSecondary};
        user-select: none;
      `,
      scroller: css`
        display: flex;
        align-items: center;
        gap: ${metrics.gap}px;
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        &::-webkit-scrollbar {
          display: none;
        }
      `,
      tab: css`
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: none;
        box-sizing: border-box;
        height: ${metrics.height}px;
        min-width: ${Math.max(40, settings.tabMinWidth)}px;
        max-width: ${Math.max(60, settings.tabMaxWidth)}px;
        padding: 0 ${metrics.padding}px;
        font-size: ${metrics.fontSize}px;
        line-height: 1;
        cursor: pointer;
        white-space: nowrap;
        color: ${token.colorText};
        border-radius: ${shape === 'line' ? 0 : `${radius}px`};
        border: ${shape === 'card' ? `1px solid ${token.colorBorderSecondary}` : '1px solid transparent'};
        background: ${shape === 'line' ? 'transparent' : token.colorFillQuaternary};
        transition:
          background 0.2s,
          color 0.2s,
          border-color 0.2s;
        &:hover {
          background: ${shape === 'line' ? token.colorFillQuaternary : token.colorFillTertiary};
        }
        &[data-active='true'] {
          color: ${token.colorPrimary};
          background: ${shape === 'line' ? 'transparent' : token.colorPrimaryBg};
          border-color: ${shape === 'card' ? token.colorPrimaryBorder : 'transparent'};
          box-shadow: ${shape === 'line' ? `inset 0 -2px 0 0 ${token.colorPrimary}` : 'none'};
        }
      `,
      title: css`
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      `,
      action: css`
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        flex: none;
        border-radius: ${token.borderRadiusSM}px;
        font-size: 10px;
        color: ${token.colorTextTertiary};
        transition:
          opacity 0.15s,
          background 0.15s;
        &:hover {
          background: ${token.colorFillSecondary};
          color: ${token.colorText};
        }
      `,
      hiddenAction: css`
        opacity: 0;
        pointer-events: none;
      `,
      revealOnHover: css`
        [data-tab='true']:hover & {
          opacity: 1;
          pointer-events: auto;
        }
      `,
      sideButton: css`
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: ${metrics.height}px;
        height: ${metrics.height}px;
        cursor: pointer;
        border-radius: ${token.borderRadius}px;
        color: ${token.colorTextSecondary};
        font-size: ${metrics.fontSize}px;
        &:hover {
          background: ${token.colorFillTertiary};
          color: ${token.colorText};
        }
      `,
    };
  }, [settings.tabShape, settings.tabMaxWidth, settings.tabMinWidth, metrics, token]);

  /* ---------------- per-tab rendering ---------------- */

  const buildMenu = useCallback(
    (tab: TabItem, index: number): MenuProps => {
      const closable = controller.isClosable(tab.key);
      const isHome = settings.pinHomeTab && tab.key === homeKey;
      return {
        items: [
          { key: 'refresh', icon: <ReloadOutlined />, label: t('Refresh') },
          { type: 'divider' },
          { key: 'close', icon: <CloseOutlined />, label: t('Close'), disabled: !closable },
          { key: 'closeOthers', label: t('Close others') },
          { key: 'closeLeft', label: t('Close tabs to the left'), disabled: index === 0 },
          { key: 'closeRight', label: t('Close tabs to the right'), disabled: index === tabs.length - 1 },
          { key: 'closeAll', label: t('Close all') },
          { type: 'divider' },
          {
            key: 'pin',
            icon: tab.pinned ? <PushpinFilled /> : <PushpinOutlined />,
            label: tab.pinned ? t('Unpin') : t('Pin'),
            disabled: isHome,
          },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          switch (key) {
            case 'refresh':
              return controller.refresh(tab.key);
            case 'close':
              return controller.close(tab.key);
            case 'closeOthers':
              return controller.closeOthers(tab.key);
            case 'closeLeft':
              return controller.closeLeft(tab.key);
            case 'closeRight':
              return controller.closeRight(tab.key);
            case 'closeAll':
              return controller.closeAll();
            case 'pin':
              return controller.togglePin(tab.key);
            default:
              return undefined;
          }
        },
      };
    },
    [controller, homeKey, settings.pinHomeTab, t, tabs.length],
  );

  const renderTab = (tab: TabItem, index: number) => {
    const active = tab.key === activeKey;
    const isHome = settings.pinHomeTab && tab.key === homeKey;
    const locked = !!tab.pinned || isHome;
    const closable = controller.isClosable(tab.key);
    const showClose =
      closable &&
      (settings.closeButtonVisibility === 'always' ||
        settings.closeButtonVisibility === 'hover' ||
        (settings.closeButtonVisibility === 'active' && active));
    const hideUntilHover = closable && settings.closeButtonVisibility === 'hover' && !active;

    const node = (
      <div
        key={tab.key}
        data-tab="true"
        data-tab-key={tab.key}
        data-active={active ? 'true' : 'false'}
        className={styles.tab}
        title={tab.title || t('Untitled')}
        onClick={() => !active && controller.activate(tab.key)}
        onMouseDown={(e) => {
          // Suppress the browser's middle-click autoscroll cursor.
          if (e.button === 1) e.preventDefault();
        }}
        onAuxClick={(e) => {
          if (e.button === 1 && settings.closeOnMiddleClick) {
            e.preventDefault();
            controller.close(tab.key);
          }
        }}
      >
        {settings.showIcon && IconComponent && tab.icon ? <IconComponent type={tab.icon} /> : null}
        <span className={styles.title}>{tab.title || t('Untitled')}</span>
        {locked ? (
          <PushpinFilled className={styles.action} />
        ) : showClose ? (
          <CloseOutlined
            className={cx(styles.action, hideUntilHover && styles.hiddenAction, hideUntilHover && styles.revealOnHover)}
            onClick={(e) => {
              e.stopPropagation();
              controller.close(tab.key);
            }}
          />
        ) : (
          <span className={cx(styles.action, styles.hiddenAction)} />
        )}
      </div>
    );

    if (!settings.contextMenuEnabled) return node;
    return (
      <Dropdown key={tab.key} menu={buildMenu(tab, index)} trigger={['contextMenu']}>
        {node}
      </Dropdown>
    );
  };

  if (!tabs.length) return null;

  return (
    <div className={styles.bar} data-simo-tab-bar="true">
      {overflowing && (
        <span className={styles.sideButton} title={t('Scroll left')} onClick={() => scrollBy(-scrollStepPx)}>
          <LeftOutlined />
        </span>
      )}
      <div ref={scrollerRef} className={styles.scroller} onWheel={onWheel}>
        {tabs.map(renderTab)}
      </div>
      {overflowing && (
        <span className={styles.sideButton} title={t('Scroll right')} onClick={() => scrollBy(scrollStepPx)}>
          <RightOutlined />
        </span>
      )}
      {settings.showRefreshButton && activeKey && (
        <span className={styles.sideButton} title={t('Refresh')} onClick={() => controller.refresh(activeKey)}>
          <ReloadOutlined />
        </span>
      )}
    </div>
  );
};

export default TabBar;
