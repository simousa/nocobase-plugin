import { Plugin } from '@nocobase/server';
import simoTabPageConfig, { DEFAULT_GLOBAL_CONFIG } from './collections/simoTabPageConfig';

export class PluginMultiTabsServer extends Plugin {
  async beforeLoad() {
    // Register the global default config table (no DB ops here; sync happens later).
    this.db.collection(simoTabPageConfig);
  }

  /**
   * Guarantee the `simoTabPageConfig` table and its `options` / `portal_tab` JSON
   * columns actually exist in the database.
   *
   * Why this is needed: `portal_tab` was added to the collection definition AFTER the
   * table was first created. NocoBase's default `db.sync()` only creates tables, it
   * does NOT alter an existing table to add a newly-declared column — so an in-place
   * upgrade leaves the `portal_tab` column missing, and every `simoTabPageConfig:list`
   * / `updatePortal` then throws `Invalid SQL column or table reference`.
   *
   * `model.sync({ alter: true })` only ADDS/modifies columns (it never drops data
   * columns), so it is safe to call repeatedly on every boot / enable.
   */
  private async ensureSchema() {
    const collection = this.db.getCollection('simoTabPageConfig');
    if (!collection) return;
    // Mirror NocoBase's own sync call: `alter: { drop: false }` adds/modifies missing
    // columns (e.g. `portal_tab`) without ever dropping existing data columns.
    await (collection as any).model.sync({ alter: { drop: false } });
  }

  /**
   * Normalize a stored `options` blob to the CURRENT schema.
   *
   * Old plugin versions stored a different shape (a legacy `portals` key, or missing
   * newer keys such as `allowPersonalization`). A legacy blob left as-is still renders,
   * but the personalization gate (`allowPersonalization`) can be `undefined` → treated as
   * "off" → the user's browser-local personal preferences silently never load until an
   * admin manually re-saves the global config. Normalizing server-side on every
   * boot/enable makes the DB canonical so no manual save is required after an upgrade.
   *
   * Strategy: start from DEFAULT_GLOBAL_CONFIG (every current key gets a default), copy
   * over any key the stored blob actually defines (preserving the admin's real values),
   * and drop any key NOT in the current schema (legacy cruft). Idempotent; never loses
   * a real setting.
   */
  private migrateOptions(stored: any): Record<string, any> {
    const base = DEFAULT_GLOBAL_CONFIG as Record<string, any>;
    const out: Record<string, any> = { ...base };
    if (stored && typeof stored === 'object') {
      for (const key of Object.keys(stored)) {
        if (key in base) out[key] = stored[key];
      }
    }
    return out;
  }

  /** Ensure exactly one global-default row exists AND that its `options` blob is in the
   * current schema. Migrating (not blind-overwriting) preserves admin config across a
   * reinstall/upgrade. Idempotent + non-destructive. */
  private async ensureRow() {
    const repo = this.db.getRepository('simoTabPageConfig');
    const existing = await repo.find({ limit: 1 });
    if (!existing.length) {
      await repo.create({
        values: { options: DEFAULT_GLOBAL_CONFIG, portal_tab: { portals: {} } },
      });
      return;
    }
    const row = existing[0] as any;
    const migrated = this.migrateOptions(row.options);
    const portalTab =
      row.portal_tab && row.portal_tab.portals ? row.portal_tab : { portals: {} };
    // Only write back when something actually changed (avoid needless writes / revisions).
    const changed =
      JSON.stringify(migrated) !== JSON.stringify(row.options) ||
      JSON.stringify(portalTab) !== JSON.stringify(row.portal_tab);
    if (changed) {
      await repo.update({
        filterByTk: row.id,
        values: { options: migrated, portal_tab: portalTab },
      });
    }
  }

  async load() {
    // Guarantee the table + columns exist BEFORE any client read/write, so an upgraded
    // install missing the `portal_tab` column never throws "Invalid SQL column or table
    // reference". Non-fatal: a failure here must not break plugin startup.
    await this.ensureSchema().catch((e) =>
      // eslint-disable-next-line no-console
      console.warn('[multi-tabs] ensureSchema failed', e),
    );
    await this.ensureRow().catch((e) =>
      // eslint-disable-next-line no-console
      console.warn('[multi-tabs] ensureRow failed', e),
    );

    /**
     * Read/write the single global-default row.
     *
     * `update` is sent with `?forceUpdate=true` (old-src pattern) because NocoBase's
     * framework-level `validateFilterParams` middleware rejects any `update` action
     * without a `filter` / `filterByTk` / `forceUpdate` in the query string. The
     * body carries the FULL config object and we persist it into the `options` JSON
     * blob, exactly like the global-default read (`rows[0].options`) expects.
     */
    this.app.resourceManager.define({
      name: 'simoTabPageConfig',
      actions: {
        // Upsert the single global-default row's `options`. Works whether or not a row exists.
        // `options` holds ONLY the global config (style, behavior, top-level default/pinned tabs).
        async update(ctx, next) {
          const params = (ctx.action as any)?.params ?? {};
          const body = (ctx.request as any)?.body ?? {};
          // Accept the config whether sent as the body directly, or wrapped in
          // { options } / { values } — robust to either client contract.
          const raw =
            body?.options ??
            body?.values ??
            params?.options ??
            params?.values ??
            body ??
            {};
          const values = { ...DEFAULT_GLOBAL_CONFIG, ...(raw || {}) };
          const repo = ctx.db.getRepository('simoTabPageConfig');
          const existing = await repo.find({ limit: 1 });
          let record;
          if (existing.length) {
            record = await repo.update({
              filterByTk: existing[0].id,
              values: { options: values },
            });
          } else {
            record = await repo.create({ values: { options: values } });
          }
          ctx.body = { data: { options: values } };
          await next();
        },

        // Upsert the per-portal default/pinned tabs into `portal_tab`. This is a SEPARATE
        // concern from `options` (global config), with its own permission snippet, so
        // configuring portal tabs never touches (or is touched by) the global config.
        // Body contract: { portals: Record<portalName, { defaultTabs, pinnedTabs }> }.
        async updatePortal(ctx, next) {
          const params = (ctx.action as any)?.params ?? {};
          const body = (ctx.request as any)?.body ?? {};
          const portals =
            body?.portals ??
            body?.values?.portals ??
            params?.portals ??
            params?.values?.portals ??
            {};
          const repo = ctx.db.getRepository('simoTabPageConfig');
          const existing = await repo.find({ limit: 1 });
          let record;
          if (existing.length) {
            record = await repo.update({
              filterByTk: existing[0].id,
              values: { portal_tab: { portals } },
            });
          } else {
            record = await repo.create({ values: { portal_tab: { portals } } });
          }
          ctx.body = { data: { portal_tab: { portals } } };
          await next();
        },
      },
    });

    // Global default config + portal tabs are readable by all logged-in users so the
    // defaults apply to everyone. Writing is gated by the dedicated snippets below.
    this.app.acl.allow(
      'simoTabPageConfig',
      ['list', 'get', 'update', 'updatePortal'],
      'loggedIn',
    );

    // Snippet: who can configure the global default (writes `options`).
    // Both the old (`pm.multi-tab.*`) and new (`pm.multi-tabs.*`) names are registered
    // so existing role grants keep working through the rename; the client accepts either.
    this.app.acl.registerSnippet({
      name: 'pm.multi-tab.global',
      actions: ['simoTabPageConfig:update'],
    });
    this.app.acl.registerSnippet({
      name: 'pm.multi-tabs.global',
      actions: ['simoTabPageConfig:update'],
    });

    // Snippet: who can configure per-portal default/fixed tabs (writes `portal_tab`).
    this.app.acl.registerSnippet({
      name: 'pm.multi-tabs.portal',
      actions: ['simoTabPageConfig:updatePortal'],
    });

    // Snippet: who can configure their own personal preferences.
    // There is no server-side resource for personal prefs (stored in the browser),
    // so this snippet is used purely as a client-side capability gate.
    this.app.acl.registerSnippet({
      name: 'pm.multi-tab.personal',
      actions: [],
    });
    this.app.acl.registerSnippet({
      name: 'pm.multi-tabs.personal',
      actions: [],
    });
  }

  async install() {
    try {
      // Make sure the table + columns exist, then migrate (NOT blind-overwrite) any
      // existing row to the current schema. An upgrade from an older plugin version
      // keeps the admin's config while gaining missing defaults (e.g.
      // `allowPersonalization`), so personal preferences work without a manual re-save.
      await this.ensureSchema();
      await this.ensureRow();
    } catch (e) {
      // Non-fatal: the table may not be synced yet at this exact moment.
      // eslint-disable-next-line no-console
      console.warn('[multi-tabs] failed to ensure config on install', e);
    }
  }

  async afterEnable() {
    // After (re)enabling, guarantee the table + columns exist so the client's first
    // read doesn't hit "Invalid SQL column or table reference", and that a default row
    // is present. Non-fatal.
    await this.ensureSchema().catch((e) =>
      // eslint-disable-next-line no-console
      console.warn('[multi-tabs] ensureSchema failed (afterEnable)', e),
    );
    await this.ensureRow().catch((e) =>
      // eslint-disable-next-line no-console
      console.warn('[multi-tabs] ensureRow failed (afterEnable)', e),
    );
  }
}

export default PluginMultiTabsServer;
