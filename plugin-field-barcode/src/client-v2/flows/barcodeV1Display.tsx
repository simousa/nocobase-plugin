/**
 * v1 (legacy `@nocobase/client`) display-as-barcode support.
 *
 * The v1 UI does NOT use the FlowModel / `registerFlow` system at all — fields
 * are rendered through the traditional Formily `x-read-pretty` pipeline, and
 * per-field "display settings" toggles are added via
 * `app.schemaSettingsManager.addItem(...)` (switch / modal items) that persist
 * their state to the field schema's `x-component-props`.
 *
 * So this lane is deliberately separate from `barcodeDisplayFlow.tsx` (which is
 * v2-only): it (1) registers a "Display as barcode" switch + a "Barcode
 * settings" modal under the field display settings, and (2) wraps the
 * read-pretty variant of the common field components so the barcode is drawn
 * in place of the original text. Edit mode is never touched.
 *
 * This mirrors the dual-mechanism pattern used by the official
 * `@nocobase/plugin-text-copy` plugin.
 */
import React from 'react';
import {
  Input,
  InputNumber,
  Select,
  DatePicker,
  TimePicker,
  UnixTimestamp,
} from '@nocobase/client';
// In the v1 (legacy `@nocobase/client`) runtime, the Formily hooks `useField`
// and `useFieldSchema` live in `@formily/react`, while the NocoBase field hooks
// `useColumnSchema` / `useDesignable` come from `@nocobase/client`. Importing
// them from `@nocobase/client-v2` (the v2 lane) is wrong — that package does not
// re-export these hooks for the v1 bundle, which caused the runtime
// `TypeError: (0, e.useField) is not a function`. This mirrors the import layout
// used by the official `@nocobase/plugin-text-copy` plugin.
import { useField, useFieldSchema } from '@formily/react';
import { useColumnSchema, useDesignable } from '@nocobase/client';
import { useTranslation } from 'react-i18next';
import { resolveOptions } from '../barcode/defaults';
import { buildOptionsSchema } from '../barcode/optionsSchema';
import BarcodeView from '../components/BarcodeView';
import BarcodeColorInput from '../components/BarcodeColorInput';

const NS = '@simo/plugin-field-barcode';
/** Where the barcode config lives inside a field schema's `x-component-props`. */
const SIMO_KEY = 'simoBarcode';

/** Read the persisted barcode config off the component props (or the raw schema). */
function readBarcodeProps(props: any) {
  if (!props) return null;
  if (props[SIMO_KEY]) return props[SIMO_KEY];
  const cp = props['x-component-props'];
  return cp?.[SIMO_KEY] ?? null;
}

/** Reduce a field value to the scalar string(s) we can encode. Objects (associations) are skipped. */
function toEncodableListV1(value: any): string[] {
  const raw = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of raw) {
    if (item === null || item === undefined || item === '') continue;
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      out.push(String(item));
    }
  }
  return out;
}

/** Wrap a read-pretty component so it renders a barcode when enabled, else the original. */
function makeBarcodeReadPretty(Original: any) {
  if (!Original || typeof Original !== 'object') return Original;
  const Wrapped: React.FC<any> = (props) => {
    const bp = readBarcodeProps(props);
    if (!bp?.enabled) return React.createElement(Original, props);

    const value = props.value !== undefined ? props.value : props.children;
    const texts = toEncodableListV1(value);
    // Nothing encodable (empty cell / association object) — keep the stock rendering.
    if (texts.length === 0) return React.createElement(Original, props);

    const resolved = resolveOptions({ ...(bp.options || {}), enabled: true });
    const name = props.name || 'barcode';

    if (texts.length === 1) {
      return React.createElement(BarcodeView, {
        value: texts[0],
        options: resolved,
        filename: name,
        fallback: React.createElement(Original, props),
      });
    }
    return React.createElement(
      'span',
      { style: { display: 'inline-flex', flexWrap: 'wrap', gap: 8 } },
      texts.map((t, i) =>
        React.createElement(BarcodeView, { key: `${i}-${t}`, value: t, options: resolved, filename: name }),
      ),
    );
  };
  Wrapped.displayName = 'BarcodeReadPretty';
  return Wrapped;
}

/**
 * Wrap a composed field component (e.g. `Input`) so its `.ReadPretty` — and any
 * nested composed variant's `.ReadPretty` (Input.TextArea / Input.URL / …) —
 * renders the barcode. Edit mode delegates straight to the original.
 */
function wrapComposed(Original: any) {
  if (!Original || (typeof Original !== 'function' && typeof Original !== 'object')) return Original;
  const Wrapped: React.FC<any> = (props) => React.createElement(Original, props);

  // Copy every static (TextArea, URL, JSON, ReadPretty, …) onto the wrapper.
  Object.keys(Original).forEach((k) => {
    (Wrapped as any)[k] = (Original as any)[k];
  });
  if ((Original as any).ReadPretty) {
    (Wrapped as any).ReadPretty = makeBarcodeReadPretty((Original as any).ReadPretty);
  }
  // Wrap nested composed variants (don't mutate the original's shared statics).
  Object.keys(Wrapped).forEach((k) => {
    const sub = (Wrapped as any)[k];
    if (sub && typeof sub === 'object' && sub.ReadPretty) {
      const copy = { ...sub };
      copy.ReadPretty = makeBarcodeReadPretty(sub.ReadPretty);
      (Wrapped as any)[k] = copy;
    }
  });
  return Wrapped;
}

export function installBarcodeDisplayV1(app: any) {
  const settingGroups = ['fieldSettings:FormItem', 'fieldSettings:TableColumn'];

  const switchItem = {
    type: 'switch',
    useVisible() {
      const field = useField();
      const { fieldSchema: col } = useColumnSchema();
      const s: any = col || useFieldSchema();
      return !!(s?.['x-read-pretty'] || (field as any)?.readPretty);
    },
    useComponentProps() {
      const { t } = useTranslation(NS);
      const field = useField();
      const { fieldSchema: col } = useColumnSchema();
      const s: any = col || useFieldSchema();
      const { dn } = useDesignable();
      return {
        title: t('Display as barcode'),
        checked: !!readBarcodeProps(s?.['x-component-props'])?.enabled,
        async onChange(v: boolean) {
          const cp = { ...(s?.['x-component-props'] || {}) };
          cp[SIMO_KEY] = { ...(cp[SIMO_KEY] || {}), enabled: v };
          s['x-component-props'] = cp;
          (field as any).componentProps = { ...((field as any).componentProps || {}), [SIMO_KEY]: cp[SIMO_KEY] };
          await dn.emit('patch', { schema: { 'x-uid': s['x-uid'], 'x-component-props': cp } });
        },
      };
    },
  };

  const modalItem = {
    type: 'modal',
    useVisible() {
      const { fieldSchema: col } = useColumnSchema();
      const s: any = col || useFieldSchema();
      return !!readBarcodeProps(s?.['x-component-props'])?.enabled;
    },
    useComponentProps() {
      const { t } = useTranslation(NS);
      const { fieldSchema: col } = useColumnSchema();
      const s: any = col || useFieldSchema();
      const { dn } = useDesignable();
      const stored = readBarcodeProps(s?.['x-component-props'])?.options || {};
      return {
        title: t('Barcode settings'),
        initialValues: { ...resolveOptions(null), ...stored },
        schema: () => ({ type: 'object', properties: buildOptionsSchema() }),
        components: { BarcodeColorInput },
        async onSubmit(values: any) {
          const cp = { ...(s?.['x-component-props'] || {}) };
          cp[SIMO_KEY] = { ...(cp[SIMO_KEY] || {}), enabled: true, options: values };
          s['x-component-props'] = cp;
          await dn.emit('patch', { schema: { 'x-uid': s['x-uid'], 'x-component-props': cp } });
        },
      };
    },
  };

  settingGroups.forEach((group) => {
    app.schemaSettingsManager.addItem(group, 'simoBarcodeEnable', switchItem);
    app.schemaSettingsManager.addItem(group, 'simoBarcodeOptions', modalItem);
  });

  // ---- Render interception: wrap the read-pretty of the common display components. ----
  const map: [any, string][] = [
    [Input, 'Input'],
    [InputNumber, 'InputNumber'],
    [Select, 'Select'],
    [DatePicker, 'DatePicker'],
    [TimePicker, 'TimePicker'],
    [UnixTimestamp, 'UnixTimestamp'],
  ];
  const named: Record<string, any> = {};
  map.forEach(([C, name]) => {
    if (C) named[name] = wrapComposed(C);
  });
  if (Object.keys(named).length) {
    app.addComponents(named);
  }
}
