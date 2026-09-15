/**
 * Custom schema-UID support for NocoBase *page tabs* (the tabs you add inside a
 * page that has "Enable tabs" turned on).
 *
 * This is the tab-side counterpart of `CustomSchemaUidMenuItemModel`. Out of the
 * box NocoBase generates a random `uid()` for every newly added tab and uses that
 * value as the tab route's `schemaUid`. This subclass lets the operator supply a
 * human-readable id instead — exactly the same capability the menu-item plugin
 * already offers for page / flowPage menu items.
 *
 * How a tab is created (core `PageModel.createPageTabModelOptions`):
 *   - Clicking "Add tab" creates a `RootPageTabModel` sub-model whose route has
 *     `schemaUid: uid()` and **no `id` yet** (not persisted).
 *   - The tab is only persisted when the operator opens its "Tab settings" dialog
 *     (`pageTabSettings` flow) and saves — which calls `RootPageTabModel.save()`.
 * So by substituting the random `uid()` for the operator-provided value *before*
 * that first `save()`, we change the tab's route id. This mirrors the menu-item
 * plugin, which only customises the schema uid at creation time.
 *
 * Editing an existing (already-persisted) tab does NOT show the field, on purpose:
 * changing the `schemaUid` of an already-published route would rewrite the URL and
 * break existing bookmarks / deep links. This matches the menu-item plugin's
 * creation-only behaviour.
 *
 * Duplicate handling: if the chosen schema UID is already in use, the form's async
 * validator rejects the value (inline error + blocks submit), so the dialog stays
 * open instead of silently falling back to a random id.
 */
import { RootPageTabModel } from '@nocobase/client-v2';
import { tExpr } from '../locale';

const PLUGIN_NAME = '@simo/plugin-custom-schema-uid';
const ROUTE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class CustomSchemaUidPageTabModel extends RootPageTabModel {
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

  /** Route repository used by the async duplicate validator. */
  private getRouteRepository() {
    return this.context.routeRepository;
  }

  /** Build the `customSchemaUid` field schema shown in the tab settings dialog. */
  public buildCustomSchemaUidField(ctx: any): Record<string, any> {
    const t = (key: string, opts?: any) => this.getT()(key, opts);
    return {
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
  }

  /**
   * Override of the core persistence routine. Identical to the upstream
   * `RootPageTabModel.save()` except that, for a brand-new (not-yet-persisted)
   * tab, the route's `schemaUid` becomes the operator-provided value instead of
   * the random `uid()` assigned in `createPageTabModelOptions`.
   */
  async save() {
    const route = this.props.route || {};
    if (route.id == null) {
      const customId = this.resolveCustomSchemaUid(this.stepParams?.pageTabSettings?.tab?.customSchemaUid);
      if (customId) {
        this.setProps({ route: { ...route, schemaUid: customId } });
      }
    }
    return super.save();
  }
}

/**
 * Re-register the "Tab settings" (`pageTabSettings`) flow on the subclass.
 *
 * FlowEngine's global flow registry falls back to the parent class for any flow
 * we do NOT re-register here, so all other tab behaviour keeps working exactly as
 * before. Because the subclass's own `pageTabSettings` definition wins on key
 * collision, our `tab` step — which adds the extra "Custom schema UID" field —
 * replaces the stock one. We spread the parent's already-registered steps and only
 * override `tab`, keeping its original `uiSchema` fields and `handler` intact.
 */
const parentPageTabSettings = RootPageTabModel.globalFlowRegistry.getFlow('pageTabSettings');
const parentPageTabSettingsSteps = parentPageTabSettings?.steps || {};
const parentTabStep = parentPageTabSettingsSteps.tab;

CustomSchemaUidPageTabModel.registerFlow({
  key: 'pageTabSettings',
  title: tExpr('Tab settings'),
  steps: {
    ...parentPageTabSettingsSteps,
    tab: {
      ...parentTabStep,
      uiSchema: async (ctx: any) => {
        const baseSchema: Record<string, any> =
          typeof parentTabStep?.uiSchema === 'function'
            ? (await parentTabStep.uiSchema(ctx)) || {}
            : (parentTabStep?.uiSchema as Record<string, any>) || {};

        const route = (ctx.model as any)?.props?.route || {};
        // Only show the custom schema uid field when adding a brand-new tab
        // (route not yet persisted). Editing an existing tab hides it, mirroring
        // the menu-item plugin which only customises at creation time.
        if (route.id == null) {
          baseSchema.customSchemaUid = (ctx.model as CustomSchemaUidPageTabModel).buildCustomSchemaUidField(ctx);
        }

        return baseSchema;
      },
    },
  },
});

export default CustomSchemaUidPageTabModel;
