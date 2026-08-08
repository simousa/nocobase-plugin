/**
 * The field-level "Barcode settings" form schema, shared by the v2 flow and
 * the v1 `schemaSettingsManager` modal. Kept in its own module so the v1 lane
 * can import it without pulling in the v2-only `ClickableFieldModel` patch.
 */
import { BARCODE_FORMATS, BarcodeOptions, QR_ERROR_LEVELS, isQrFormat } from '../../constants';
import { getGlobalDefaults } from './defaults';
import { tExpr } from '../locale';

const formatOptions = BARCODE_FORMATS.map((f) => ({ value: f.value, label: f.label }));

export function buildOptionsSchema() {
  const defaults = getGlobalDefaults();
  return {
    format: {
      type: 'string',
      title: tExpr('Symbology'),
      enum: formatOptions,
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': { style: { width: '100%' }, showSearch: true, optionFilterProp: 'label' },
    },
    /* ---- 1D only ---- */
    barWidth: {
      type: 'number',
      title: tExpr('Bar width (px)'),
      'x-decorator': 'FormItem',
      'x-component': 'NumberPicker',
      'x-component-props': { min: 1, max: 10, step: 0.5, style: { width: '100%' } },
      'x-reactions': {
        dependencies: ['format'],
        fulfill: { state: { visible: "{{$deps[0] !== 'QRCODE'}}" } },
      },
    },
    barHeight: {
      type: 'number',
      title: tExpr('Bar height (px)'),
      'x-decorator': 'FormItem',
      'x-component': 'NumberPicker',
      'x-component-props': { min: 10, max: 300, step: 5, style: { width: '100%' } },
      'x-reactions': {
        dependencies: ['format'],
        fulfill: { state: { visible: "{{$deps[0] !== 'QRCODE'}}" } },
      },
    },
    displayValue: {
      type: 'boolean',
      title: tExpr('Show text under the bars'),
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-reactions': {
        dependencies: ['format'],
        fulfill: { state: { visible: "{{$deps[0] !== 'QRCODE'}}" } },
      },
    },
    fontSize: {
      type: 'number',
      title: tExpr('Text size (px)'),
      'x-decorator': 'FormItem',
      'x-component': 'NumberPicker',
      'x-component-props': { min: 6, max: 48, style: { width: '100%' } },
      'x-reactions': {
        dependencies: ['format', 'displayValue'],
        fulfill: { state: { visible: "{{$deps[0] !== 'QRCODE' && !!$deps[1]}}" } },
      },
    },
    textMargin: {
      type: 'number',
      title: tExpr('Text spacing (px)'),
      'x-decorator': 'FormItem',
      'x-component': 'NumberPicker',
      'x-component-props': { min: 0, max: 40, style: { width: '100%' } },
      'x-reactions': {
        dependencies: ['format', 'displayValue'],
        fulfill: { state: { visible: "{{$deps[0] !== 'QRCODE' && !!$deps[1]}}" } },
      },
    },
    /* ---- QR only ---- */
    qrCellSize: {
      type: 'number',
      title: tExpr('Module size (px)'),
      'x-decorator': 'FormItem',
      'x-component': 'NumberPicker',
      'x-component-props': { min: 1, max: 20, style: { width: '100%' } },
      'x-reactions': {
        dependencies: ['format'],
        fulfill: { state: { visible: "{{$deps[0] === 'QRCODE'}}" } },
      },
    },
    qrErrorLevel: {
      type: 'string',
      title: tExpr('Error correction level'),
      enum: QR_ERROR_LEVELS.map((l) => ({ value: l.value, label: l.label })),
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': { style: { width: '100%' } },
      'x-reactions': {
        dependencies: ['format'],
        fulfill: { state: { visible: "{{$deps[0] === 'QRCODE'}}" } },
      },
    },
    /* ---- shared ---- */
    margin: {
      type: 'number',
      title: tExpr('Quiet zone (px)'),
      'x-decorator': 'FormItem',
      'x-component': 'NumberPicker',
      'x-component-props': { min: 0, max: 60, style: { width: '100%' } },
    },
    lineColor: {
      type: 'string',
      title: tExpr('Foreground colour'),
      'x-decorator': 'FormItem',
      'x-component': 'BarcodeColorInput',
    },
    background: {
      type: 'string',
      title: tExpr('Background colour'),
      'x-decorator': 'FormItem',
      'x-component': 'BarcodeColorInput',
      'x-component-props': { allowTransparent: true },
    },
    originalTextMode: {
      type: 'string',
      title: tExpr('Original text'),
      enum: [
        { value: 'none', label: tExpr('Hidden') },
        { value: 'inline', label: tExpr('Next to the barcode') },
        { value: 'below', label: tExpr('Below the barcode') },
      ],
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': { style: { width: '100%' } },
    },
    /* ---- behaviour ---- */
    fallbackToText: {
      type: 'boolean',
      title: tExpr('Fall back to the original text when the value cannot be encoded'),
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
    },
    clickToPreview: {
      type: 'boolean',
      title: tExpr('Click to enlarge'),
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
    },
    downloadable: {
      type: 'boolean',
      title: tExpr('Allow downloading the image'),
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-reactions': {
        dependencies: ['clickToPreview'],
        fulfill: { state: { visible: '{{!!$deps[0]}}' } },
      },
    },
    __hint: {
      type: 'void',
      'x-component': 'Alert',
      'x-component-props': {
        type: 'info',
        showIcon: true,
        style: { marginTop: 8 },
        message: tExpr('Only the display changes — the stored value is never modified.'),
      },
    },
    ...(defaults ? {} : {}),
  };
}
