import path from 'path';
import { Plugin } from '@nocobase/server';
import {
  BUILT_IN_DEFAULTS,
  SETTINGS_ACL_SNIPPET,
  SETTINGS_COLLECTION,
  SETTINGS_RESOURCE,
  TabPageGlobalConfig,
} from '../constants';

const ALLOWED_KEYS = Object.keys(BUILT_IN_DEFAULTS);

/**
 * The server side is intentionally tiny: everything the plugin does happens in
 * the browser. All we persist is a single row of *global defaults* that every
 * user's browser reads on boot and may partially override locally.
 */
export class PluginTabPageServer extends Plugin {
  /** Read the stored settings, merged on top of the built-in ones. */
  async getGlobalConfig(): Promise<TabPageGlobalConfig> {
    const repo = this.db.getRepository(SETTINGS_COLLECTION);
    if (!repo) {
      return { ...BUILT_IN_DEFAULTS };
    }
    let row: any = null;
    try {
      row = await repo.findOne({ sort: ['id'] });
    } catch (e) {
      // Table not synced yet (e.g. right after `pm add`) — fall back silently.
      this.app.logger.debug(`[${SETTINGS_RESOURCE}] settings table not ready: ${e?.message}`);
    }
    return { ...BUILT_IN_DEFAULTS, ...(row?.options || {}) };
  }

  /** Whitelist the incoming payload so unknown keys never reach the database. */
  private pick(values: Record<string, any>): Partial<TabPageGlobalConfig> {
    const out: Record<string, any> = {};
    for (const key of ALLOWED_KEYS) {
      if (values?.[key] !== undefined) {
        out[key] = values[key];
      }
    }
    return out as Partial<TabPageGlobalConfig>;
  }

  async setGlobalConfig(values: Record<string, any>): Promise<TabPageGlobalConfig> {
    const repo = this.db.getRepository(SETTINGS_COLLECTION);
    const options: TabPageGlobalConfig = { ...BUILT_IN_DEFAULTS, ...this.pick(values || {}) };
    const row: any = await repo.findOne({ sort: ['id'] });
    if (row) {
      await repo.update({ filterByTk: row.get('id'), values: { options } });
    } else {
      await repo.create({ values: { options } });
    }
    return options;
  }

  async load() {
    await this.importCollections(path.resolve(__dirname, 'collections'));

    // Seed the single settings row once the table has been synced. `install()`
    // alone is not re-run on a re-enable, so this keeps the row present.
    this.db.on(`${SETTINGS_COLLECTION}.afterSync`, () => {
      this.ensureSeed().catch((e) =>
        this.app.logger.warn(`[${SETTINGS_RESOURCE}] seed failed: ${e?.message}`),
      );
    });

    this.app.resourceManager.define({
      name: SETTINGS_RESOURCE,
      actions: {
        /** GET /api/simoTabPageSettings:get — read the effective global settings. */
        get: async (ctx: any, next: any) => {
          ctx.body = await this.getGlobalConfig();
          await next();
        },
        /**
         * POST /api/simoTabPageSettings:update?forceUpdate=true
         *
         * NOTE: `forceUpdate` **must** be sent as a query parameter — the
         * framework-level `validateFilterParams` middleware rejects any
         * `update` action without `filter` / `filterByTk` / `forceUpdate`.
         */
        update: async (ctx: any, next: any) => {
          const values = ctx.action?.params?.values ?? ctx.request?.body ?? {};
          ctx.body = await this.setGlobalConfig(values);
          await next();
        },
      },
    });

    // Every authenticated user must be able to read the settings, otherwise
    // the tab bar would silently fall back to the built-in defaults.
    this.app.acl.allow(SETTINGS_RESOURCE, 'get', 'loggedIn');
    // Writing is a plugin-settings operation, guarded by the `pm.*` snippet.
    this.app.acl.registerSnippet({
      name: SETTINGS_ACL_SNIPPET,
      actions: [`${SETTINGS_RESOURCE}:update`],
    });
  }

  /** Idempotently ensure the single settings row exists. */
  private async ensureSeed() {
    const repo = this.db.getRepository(SETTINGS_COLLECTION);
    if (!repo) return;
    const existing = await repo.findOne({ sort: ['id'] });
    if (!existing) {
      await repo.create({ values: { options: { ...BUILT_IN_DEFAULTS } } });
    }
  }

  async install() {
    await this.ensureSeed();
  }
}

export default PluginTabPageServer;
