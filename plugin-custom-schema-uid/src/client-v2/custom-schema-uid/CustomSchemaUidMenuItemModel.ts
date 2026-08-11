/**
 * Custom schema-UID support for the NocoBase desktop menu and routes.
 *
 * Out of the box NocoBase generates a random `uid()` for every new menu page and
 * uses that value as the page's `schemaUid`, which shows up in the URL as
 * `/admin/<random>` (or `/v/admin/<random>` under the v2 runtime). This subclass
 * lets the operator supply a human-readable id instead.
 *
 * The change is surgical: NocoBase persists the page's `schemaUid` on the
 * `desktopRoutes` record and creates the page's flow model (`flowModels`) with
 * `uid = schemaUid` in `desktopRoutes.afterCreate`. So by substituting the random
 * `uid()` for the operator-provided value we change the route id for both
 * `page` (legacy / v1-style) and `flowPage` (v2) menu types — which maps onto
 * `/admin/<id>` and `/v/admin/<id>`.
 *
 * Group and link menu items are intentionally left untouched: a group's URL is
 * derived from the route's auto-generated record `id` (a snowflake), and a link
 * has no page schema at all, so a custom id would have no effect there.
 *
 * Duplicate handling: if the chosen schema UID is already in use, the form's
 * async validator rejects the value (shows an inline error and blocks submit), so
 * the dialog stays open instead of silently falling back to a random id.
 */
import { AdminLayoutMenuItemModel, getMenuCreationDefaultParams, getMenuCreationUiSchema } from '@nocobase/client-v2';
import { uid } from '@nocobase/utils/client';
import { tExpr } from '../locale';

const PLUGIN_NAME = '@simo/plugin-custom-schema-uid';
const ROUTE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class CustomSchemaUidMenuItemModel extends AdminLayoutMenuItemModel {
  /**
   * Validate + normalise a user-supplied schema uid.
   * Returns the cleaned value, or `null` when the field should be ignored
   * (empty / invalid) so the caller falls back to NocoBase's random `uid()`.
   */
  private resolveCustomSchemaUid(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.trim();
    if (!cleaned) return null;
    if (!ROUTE_ID_PATTERN.test(cleaned)) return null;
    return cleaned;
  }

  /** `t()` bound to this plugin's namespace, safe to call outside React. */
  private getT(): (key: string, opts?: any) => string {
    try {
      const i18n: any = (this.flowEngine?.context as any)?.i18n;
      if (typeof i18n?.t === 'function') {
        return (key: string, opts?: any) => i18n.t(key, { ns: [PLUGIN_NAME, 'client'], ...(opts || {}) });
      }
    } catch {
      /* context/i18n not ready — fall through to raw key */
    }
    return (key: string) => key;
  }

  /** Build the `customSchemaUid` field schema, optionally hidden for non-page types. */
  public buildCustomSchemaUidField(ctx: any, withTypeReaction = false): Record<string, any> {
    const t = (key: string, opts?: any) => this.getT()(key, opts);
    const field: Record<string, any> = {
      title: tExpr('Custom schema UID'),
      description: tExpr(
        'Used as the route (schema UID). Letters, numbers, hyphen and underscore only. Leave empty to auto-generate.',
      ),
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: tExpr('e.g. custom-page-a123'),
        maxLength: 64,
      },
      'x-validator': async (value: any) => {
        if (!value) return;
        if (!ROUTE_ID_PATTERN.test(String(value))) {
          return t('Custom schema UID can only contain letters, numbers, underscores and hyphens.');
        }
        const existing = this.getRouteRepository()?.getRouteBySchemaUid?.(String(value));
        if (existing) {
          return t('Custom schema UID "{{id}}" is already in use, please choose another one.', { id: String(value) });
        }
        return;
      },
    };

    if (withTypeReaction) {
      field['x-reactions'] = {
        dependencies: ['menuType'],
        fulfill: {
          state: {
            hidden: '{{$deps[0] !== "page" && $deps[0] !== "flowPage"}}',
          },
        },
      };
    }

    return field;
  }

  /**
   * Override of the core creation routine. Everything is identical to the
   * upstream implementation except that, for page / flowPage types, the page's
   * `schemaUid` becomes the operator-provided value instead of a random uid.
   */
  async createMenuFromMeta(meta: any, values: any): Promise<void> {
    const isPage = meta?.menuType === 'page' || meta?.menuType === 'flowPage';
    const customId = isPage ? this.resolveCustomSchemaUid(values?.customSchemaUid) : null;

    const createRoute = async (route: any, options?: any) => {
      let target = route;

      if (customId) {
        target = { ...route, schemaUid: customId };
      }

      if (meta?.insertPosition) {
        return this.createRouteForInsert(
          target,
          meta.insertPosition,
          meta.targetRoute || this.getCreationMeta()?.targetRoute || this.getRoute(),
        );
      }
      return this.createMenuRoute(target, { parentId: meta?.parentRoute?.id });
    };

    if (meta?.menuType === 'group') {
      await createRoute({ type: 'group', title: values?.title, icon: values?.icon, schemaUid: uid() });
      return;
    }

    if (meta?.menuType === 'link') {
      await createRoute({
        type: 'link',
        title: values?.title,
        icon: values?.icon,
        schemaUid: uid(),
        options: {
          href: values?.href,
          params: values?.params,
          openInNewWindow: values?.openInNewWindow,
        },
      });
      return;
    }

    const pageSchemaUid = customId || uid();
    const menuSchemaUid = uid();
    const tabSchemaUid = uid();
    const tabSchemaName = uid();

    await createRoute({
      type: meta?.menuType === 'flowPage' ? 'flowPage' : 'page',
      title: values?.title,
      icon: values?.icon,
      schemaUid: pageSchemaUid,
      menuSchemaUid,
      enableTabs: false,
      children: [
        {
          type: 'tabs',
          schemaUid: tabSchemaUid,
          tabSchemaName,
          hidden: true,
        },
      ],
    });
  }
}

/** Wrap an insert step so its form shows the custom schema-uid field. */
function withCustomSchemaUidStep(step: any) {
  if (!step) return step;
  const origUiSchema = step.uiSchema;
  return {
    ...step,
    uiSchema: async (ctx: any) => {
      const schema: Record<string, any> = (await origUiSchema(ctx)) || {};
      schema.customSchemaUid = (ctx.model as CustomSchemaUidMenuItemModel).buildCustomSchemaUidField(ctx, true);
      return schema;
    },
  };
}

/**
 * Re-register the "Add menu item" (`menuCreation`) flow on the subclass.
 *
 * FlowEngine's global flow registry falls back to the parent class for any flow
 * we do NOT re-register here, so the `menuSettings` / insert flows keep working
 * exactly as before. Because the subclass's own `menuCreation` definition wins
 * on key collision, our schema with the extra "Custom schema UID" field replaces
 * the stock one.
 */
CustomSchemaUidMenuItemModel.registerFlow({
  key: 'menuCreation',
  title: 'Add menu item',
  manual: true,
  steps: {
    basic: {
      title: 'Add menu item',
      preset: true,
      hideInSettings: true,
      defaultParams: async (ctx: any) => getMenuCreationDefaultParams(ctx.model.getCreationMeta()),
      uiSchema: async (ctx: any) => {
        const schema: Record<string, any> = getMenuCreationUiSchema(ctx.t, ctx.model.getCreationMeta());
        const meta = ctx.model.getCreationMeta();

        // Only pages get a custom schema uid (groups use the record id, links have
        // no page schema). For other types we simply don't show the field.
        if (meta?.menuType === 'page' || meta?.menuType === 'flowPage') {
          schema.customSchemaUid = (ctx.model as CustomSchemaUidMenuItemModel).buildCustomSchemaUidField(ctx, false);
        }

        return schema;
      },
    },
  },
});

/**
 * Re-register the "Menu settings" (`menuSettings`) flow. Because `registerFlow`
 * replaces the whole flow (steps are NOT merged), we spread the parent class's
 * already-registered steps and only override the three insert steps
 * (`insertBefore` / `insertAfter` / `insertInner`) so their dialogs also show the
 * custom schema-uid field. All other steps (edit, linkage rules, move, ...) keep
 * working exactly as before.
 */
const parentMenuSettings = AdminLayoutMenuItemModel.globalFlowRegistry.getFlow('menuSettings');
const parentMenuSettingsSteps = parentMenuSettings?.steps || {};

CustomSchemaUidMenuItemModel.registerFlow({
  key: 'menuSettings',
  title: 'Menu settings',
  steps: {
    ...parentMenuSettingsSteps,
    insertBefore: withCustomSchemaUidStep(parentMenuSettingsSteps.insertBefore),
    insertAfter: withCustomSchemaUidStep(parentMenuSettingsSteps.insertAfter),
    insertInner: withCustomSchemaUidStep(parentMenuSettingsSteps.insertInner),
  },
});

export default CustomSchemaUidMenuItemModel;
