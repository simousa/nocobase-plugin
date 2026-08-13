import { Plugin, Application } from '@nocobase/client-v2';
import { mountMultiTabs, patchHistory } from './utils/dom';
import {
  getPortalKey,
  getAppBasename,
  setPortalApp,
  setPortalRecords,
  PORTAL_RECORDS_UPDATED,
  type PortalRecord,
} from './utils/portal';

export class PluginMultiTabsClientV2 extends Plugin<any, Application> {
  async load() {
    // 1. Inject the multi-tab bar (pure DOM insertion + isolated React root).
    //    No React Provider is used, per NocoBase plugin constraints.
    const apiClient = this.app.apiClient;
    // Share the Application instance so utils/portal.ts can read the basename via the
    // framework's own `app.router.getBasename()` method (never the `.basename` *property*,
    // which can be undefined on the plugin instance and throw). This is the exact API
    // NocoBase's multi-portal plugin uses — the most stable basename source.
    setPortalApp(this.app);
    // Navigation + basename use `app.router` (canonically available during plugin load
    // in NocoBase v3). Optional chaining keeps this safe even if the router isn't ready.
    const navigate = (to: string) => this.app.router?.navigate?.(to);
    // getAppBasename() reads app.router.getBasename() internally (method, never the
    // `.basename` property) and falls back to a URL derivation — always a string.
    const getBasename = (): string => getAppBasename();
    // Resolve the current portal (门户) by its NocoBase `portalName` (fetched from
    // multiPortals:listEnabled) — stable, basename-independent, unique per portal.
    const getPortalKeyForBar = () => getPortalKey(this.app.name);

    patchHistory(() => window.dispatchEvent(new CustomEvent('simo:route-changed')));

    mountMultiTabs({
      apiClient,
      navigate,
      getBasename,
      getPortalKey: getPortalKeyForBar,
      t: (s: string) => this.t(s) as unknown as string,
    });

    // 2. Best-effort: load the multi-portal records so portalName-based resolution works.
    //    Fires after mount so the bar appears immediately; when records arrive we refresh
    //    the bar's portal key (PORTAL_RECORDS_UPDATED). If the multi-portal plugin is
    //    absent / no permission, resolution gracefully falls back to the app name.
    void this.loadPortalRecords();

    // 2. Settings pages.
    this.pluginSettingsManager.addMenuItem({
      key: 'multi-tabs',
      title: this.t('Multi-tabs'),
      icon: 'TagOutlined',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'multi-tabs',
      key: 'global',
      title: this.t('Global default'),
      componentLoader: () => import('./components/settings/GlobalConfigPage'),
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'multi-tabs',
      key: 'personal',
      title: this.t('Personal preferences'),
      componentLoader: () => import('./components/settings/PersonalConfigPage'),
    });
    // Portal default/fixed tabs — same level as global/personal, with its own route.
    // Writes the separate `portal_tab` column, gated by `pm.multi-tabs.portal`.
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'multi-tabs',
      key: 'portal',
      title: this.t('Portal default/fixed tabs'),
      componentLoader: () => import('./components/settings/PortalConfigPage'),
    });
  }

  /**
   * Fetch the multi-portal records (`multiPortals:listEnabled`) and cache them so the
   * bar can resolve the current portal by its NocoBase `portalName`. Mirrors the exact
   * request the multi-portal plugin itself makes (skipAuth/skipNotify, since this may run
   * before auth settles). Best-effort: a missing multi-portal plugin / no permission simply
   * leaves the records empty and the bar falls back to the app name.
   */
  private async loadPortalRecords() {
    try {
      const res = await this.app.apiClient.request({
        url: 'multiPortals:listEnabled',
        method: 'get',
        skipAuth: true,
        skipNotify: true,
        params: { pageSize: 200 },
      });
      const items = (res?.data?.data as any[]) || [];
      const records: PortalRecord[] = items.map((it: any) => ({
        uid: it.uid,
        portalName: it.portalName,
        routePath: it.routePath,
        title: it.title,
        enabled: it.enabled,
      }));
      setPortalRecords(records);
      // Let the bar re-resolve its portal key now that records are available.
      window.dispatchEvent(new CustomEvent(PORTAL_RECORDS_UPDATED));
    } catch {
      /* multi-portal plugin absent or no permission — single-portal fallback */
    }
  }
}

export default PluginMultiTabsClientV2;
