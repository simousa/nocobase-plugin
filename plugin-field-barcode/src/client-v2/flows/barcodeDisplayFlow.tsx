/**
 * Injects a "Display as barcode" switch plus a settings dialog into the
 * display settings of **every** field model that derives from
 * `ClickableFieldModel`, and intercepts the rendering of those models.
 *
 * Why patch instead of shipping a dedicated field component?
 * ---------------------------------------------------------
 * A standalone `BarcodeFieldModel` would be persisted into
 * `stepParams.fieldBinding.use`. Once this plugin is disabled the class is no
 * longer registered and `flowEngine._resolveModelClass` renders an
 * `ErrorFlowModel` ("Model class '…' not found"). By only *decorating* the
 * built-in models we guarantee requirement #3: with the plugin disabled this
 * file is never loaded, the flow is never registered, the stored params are
 * simply ignored, and the field falls back to its original text rendering.
 */
import React from 'react';
import { ClickableFieldModel, DisplayEnumFieldModel } from '@nocobase/client-v2';
import {
  BARCODE_FLOW_KEY,
  BarcodeOptions,
  isQrFormat,
} from '../../constants';
import { getGlobalDefaults, resolveOptions } from '../barcode/defaults';
import { buildOptionsSchema } from '../barcode/optionsSchema';
import BarcodeView from '../components/BarcodeView';
import { tExpr } from '../locale';

/** Instance property that carries the resolved options from flow → render. */
const OPTIONS_KEY = '__simoBarcodeOptions';
/** Marker put on the patched method so we never wrap twice. */
const PATCH_FLAG = '__simoBarcodePatched';

/* ------------------------------------------------------------------ */
/* Flow                                                                */
/* ------------------------------------------------------------------ */

/**
 * Resolve the effective options from the *shared* stepParams so that forked
 * models (one per table row) all agree, then stash them on the model
 * instance. We deliberately avoid `setProps` because the base
 * `renderInDisplayStyle` spreads unknown props straight onto a DOM node,
 * which would trigger React "unknown prop" warnings.
 */
function applyBarcodeOptions(ctx: any) {
  const model = ctx.model;
  const params = model?.getStepParams?.(BARCODE_FLOW_KEY) || {};
  const enabled = !!params?.enable?.enabled;
  const resolved = resolveOptions({ ...(params?.options || {}), enabled });
  model[OPTIONS_KEY] = resolved;
}

const barcodeFlowDefinition = {
  key: BARCODE_FLOW_KEY,
  title: tExpr('Barcode'),
  // After the built-in `displayFieldSettings` (sort 200) so the entries stay
  // grouped at the bottom of the field settings menu.
  sort: 250,
  steps: {
    enable: {
      title: tExpr('Display as barcode'),
      uiMode: { type: 'switch', key: 'enabled' },
      defaultParams: { enabled: false },
      handler(ctx: any) {
        applyBarcodeOptions(ctx);
      },
      async afterParamsSave(ctx: any) {
        applyBarcodeOptions(ctx);
        ctx.model.invalidateFlowCache?.('beforeRender', true);
        await ctx.model.rerender?.();
      },
    },
    options: {
      title: tExpr('Barcode settings'),
      uiSchema: () => buildOptionsSchema(),
      defaultParams: () => {
        const { enabled, ...rest } = resolveOptions(null) as BarcodeOptions;
        return rest;
      },
      hideInSettings(ctx: any) {
        // Only offer the parameter dialog once the switch is on.
        return !ctx.model?.getStepParams?.(BARCODE_FLOW_KEY, 'enable')?.enabled;
      },
      handler(ctx: any) {
        applyBarcodeOptions(ctx);
      },
      async afterParamsSave(ctx: any) {
        applyBarcodeOptions(ctx);
        ctx.model.invalidateFlowCache?.('beforeRender', true);
        await ctx.model.rerender?.();
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Render interception                                                 */
/* ------------------------------------------------------------------ */

function readOptions(model: any): BarcodeOptions | undefined {
  // For forked models (table rows) the proxy resolves this through
  // `localProperties` and then the master, so a plain property read works.
  return model?.[OPTIONS_KEY];
}

/**
 * Reduce a single value to a scalar suitable for encoding.
 *
 * Association records arrive as objects; the built-in renderer resolves them
 * through the configured title field, so we do the same instead of giving up.
 */
function toEncodableText(model: any, value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const titleField = model?.props?.titleField || model?.props?.fieldNames?.label;
    const title = titleField ? value[titleField] : undefined;
    if (title !== null && title !== undefined && title !== '') return String(title);
    return null;
  }
  return null;
}

/** Split an incoming value into the list of symbols that should be rendered. */
function toEncodableList(model: any, value: any): string[] {
  const raw = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of raw) {
    const text = toEncodableText(model, item);
    if (text !== null) out.push(text);
  }
  return out;
}

/**
 * Wrap `renderInDisplayStyle` on a prototype. When the barcode switch is off
 * the original implementation runs untouched.
 */
function patchRenderInDisplayStyle(proto: any) {
  if (!proto || typeof proto.renderInDisplayStyle !== 'function') return;
  // The guard lives on the function itself, so the v1 and v2 lanes — which
  // each bundle their own copy of this module but share the same model class —
  // cannot double-wrap it.
  if (proto.renderInDisplayStyle[PATCH_FLAG]) return;

  const original = proto.renderInDisplayStyle;

  function patched(this: any, value: any, record?: any, isToMany?: any, wrap?: any) {
    const options = readOptions(this);
    if (!options?.enabled) {
      return original.call(this, value, record, isToMany, wrap);
    }

    const texts = toEncodableList(this, value);
    if (texts.length === 0) {
      // Nothing to encode (empty cell) — keep the stock "N/A"/empty rendering.
      return original.call(this, value, record, isToMany, wrap);
    }

    const fieldName = this?.context?.collectionField?.name || 'barcode';
    const fallback = original.call(this, value, record, isToMany, wrap);

    if (texts.length === 1) {
      return <BarcodeView value={texts[0]} options={options} filename={fieldName} fallback={fallback} />;
    }

    // to-many / multi-value fields get one symbol per entry.
    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {texts.map((text, index) => (
          <BarcodeView key={`${index}-${text}`} value={text} options={options} filename={fieldName} />
        ))}
      </span>
    );
  }

  (patched as any)[PATCH_FLAG] = true;
  proto.renderInDisplayStyle = patched;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

let installed = false;

/**
 * Register the flow and install the render patch. Safe to call from both
 * client lanes — everything is idempotent.
 */
export function installBarcodeDisplay() {
  if (installed) return;
  installed = true;

  // `getFlows()` walks the prototype chain, so registering on the base class
  // makes the entries appear on DisplayText / DisplayNumber / DisplayDateTime /
  // DisplayTime / DisplayPercent / DisplayTitle (and URL / JSON / HTML which
  // extend it) — i.e. details, popups, tables, lists … everywhere.
  if (!(ClickableFieldModel as any)[`__simoBarcodeFlow`]) {
    (ClickableFieldModel as any).registerFlow(barcodeFlowDefinition);
    (ClickableFieldModel as any).__simoBarcodeFlow = true;
  }

  patchRenderInDisplayStyle((ClickableFieldModel as any).prototype);
  // `DisplayEnumFieldModel` is the only subclass with its own implementation.
  patchRenderInDisplayStyle((DisplayEnumFieldModel as any).prototype);
}

export { isQrFormat };
export default installBarcodeDisplay;
