import path from 'path';
import { Plugin } from '@nocobase/server';
import {
  BUILT_IN_GLOBAL_DEFAULTS,
  SETTINGS_ACL_SNIPPET,
  SETTINGS_COLLECTION,
  SETTINGS_RESOURCE,
} from '../constants';

const ALLOWED_KEYS = Object.keys(BUILT_IN_GLOBAL_DEFAULTS);

/**
 * The server side of this plugin is intentionally tiny: barcodes are generated
 * in the browser, and no field value is ever rewritten. All we persist is one
 * row of *display defaults* shared by every field.
 */
export class PluginFieldBarcodeServer extends Plugin {
  /** Read the stored defaults, merged on top of the built-in ones. */
  async getGlobalDefaults(): Promise<Record<string, any>> {
    const repo = this.db.getRepository(SETTINGS_COLLECTION);
    if (!repo) {
      return { ...BUILT_IN_GLOBAL_DEFAULTS };
    }
    let row: any = null;
    try {
      row = await repo.findOne({ sort: ['id'] });
    } catch (e) {
      // Table not synced yet (e.g. right after `pm add`) — fall back silently.
      this.app.logger.debug(`[${SETTINGS_RESOURCE}] settings table not ready: ${e?.message}`);
    }
    return { ...BUILT_IN_GLOBAL_DEFAULTS, ...(row?.options || {}) };
  }

  /** Whitelist the incoming payload so unknown keys never reach the database. */
  private pick(values: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of ALLOWED_KEYS) {
      if (values?.[key] !== undefined) {
        out[key] = values[key];
      }
    }
    return out;
  }

  async setGlobalDefaults(values: Record<string, any>): Promise<Record<string, any>> {
    const repo = this.db.getRepository(SETTINGS_COLLECTION);
    const options = { ...BUILT_IN_GLOBAL_DEFAULTS, ...this.pick(values || {}) };
    const row: any = await repo.findOne({ sort: ['id'] });
    if (row) {
      await repo.update({ filterByTk: row.get('id'), values: { options } });
    } else {
      await repo.create({ values: { options } });
    }
    return options;
  }

  async load() {
    // Register the `simoBarcodeConfig` collection (single row of display
    // defaults) with the app database so the table is created on sync and the
    // resource below can read/write it.
    await this.importCollections(path.resolve(__dirname, 'collections'));

    // Seed the single defaults row once the table has been synced. Listening
    // for the collection-specific `afterSync` event guarantees the table
    // exists; `install()` alone is not re-run on a re-enable, so this keeps the
    // row present. `ensureSeed` is idempotent.
    this.db.on(`${SETTINGS_COLLECTION}.afterSync`, () => {
      this.ensureSeed().catch((e) =>
        this.app.logger.warn(`[${SETTINGS_RESOURCE}] seed failed: ${e?.message}`),
      );
    });

    this.app.resourceManager.define({
      name: SETTINGS_RESOURCE,
      actions: {
        /** GET /api/simoBarcodeSettings:get — read the effective defaults. */
        get: async (ctx: any, next: any) => {
          ctx.body = await this.getGlobalDefaults();
          await next();
        },
        /** POST /api/simoBarcodeSettings:update — overwrite the defaults. */
        update: async (ctx: any, next: any) => {
          const values = ctx.action?.params?.values ?? ctx.request?.body ?? {};
          ctx.body = await this.setGlobalDefaults(values);
          await next();
        },
      },
    });

    // Every authenticated user needs to read the defaults, otherwise fields
    // configured as barcodes would render with the built-in settings only.
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
      await repo.create({ values: { options: { ...BUILT_IN_GLOBAL_DEFAULTS } } });
    }
  }

  /** Seed the single settings row on first install. */
  async install() {
    await this.ensureSeed();
  }
}

export default PluginFieldBarcodeServer;
