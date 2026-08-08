/**
 * Global default barcode options.
 *
 * Rendered at `/admin/settings/barcode-display`. Shared verbatim by the v1 and
 * v2 client lanes — it only depends on antd and `@nocobase/flow-engine`, both
 * of which behave identically in either lane.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Form, InputNumber, Row, Select, Space, Spin, Switch, message } from 'antd';
import { useFlowEngine } from '@nocobase/flow-engine';
import {
  BARCODE_FORMATS,
  BarcodeGlobalDefaults,
  BarcodeOptions,
  BUILT_IN_GLOBAL_DEFAULTS,
  QR_ERROR_LEVELS,
  isQrFormat,
} from '../../constants';
import { getGlobalDefaults, loadGlobalDefaults, saveGlobalDefaults } from '../barcode/defaults';
import BarcodeColorInput from '../components/BarcodeColorInput';
import BarcodeView from '../components/BarcodeView';
import { useT } from '../locale';

const formatOptions = BARCODE_FORMATS.map((f) => ({ value: f.value, label: f.label }));
const errorLevelOptions = QR_ERROR_LEVELS.map((l) => ({ value: l.value, label: l.label }));

/** A value that is actually encodable by the selected symbology. */
function sampleFor(format: string): string {
  switch (format) {
    case 'EAN13':
      return '5901234123457';
    case 'EAN8':
      return '96385074';
    case 'EAN5':
      return '54495';
    case 'EAN2':
      return '53';
    case 'UPC':
      return '036000291452';
    case 'UPCE':
      return '01234565';
    case 'ITF14':
      return '10012345678902';
    case 'ITF':
      return '12345678';
    case 'MSI':
    case 'MSI10':
    case 'MSI11':
    case 'MSI1010':
    case 'MSI1110':
      return '1234567';
    case 'pharmacode':
      return '1234';
    case 'codabar':
      return 'A123456A';
    case 'CODE39':
    case 'CODE128C':
      return format === 'CODE128C' ? '12345678' : 'NOCOBASE-123';
    case 'QRCODE':
      return 'https://www.nocobase.com';
    default:
      return 'NocoBase-123456';
  }
}

export const GlobalBarcodeSettingsPage: React.FC = () => {
  const t = useT();
  const engine = useFlowEngine();
  const api = (engine as any)?.context?.api;
  const [form] = Form.useForm<BarcodeGlobalDefaults>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<BarcodeGlobalDefaults>(getGlobalDefaults());

  useEffect(() => {
    let alive = true;
    (async () => {
      const next = api ? await loadGlobalDefaults(api) : getGlobalDefaults();
      if (!alive) return;
      form.setFieldsValue(next as any);
      setValues(next);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const isQr = isQrFormat(values.format);

  const previewOptions = useMemo<BarcodeOptions>(
    () => ({
      ...(values as BarcodeGlobalDefaults),
      enabled: true,
      // The preview is always clickable so the modal can be tried out here.
      clickToPreview: true,
    }),
    [values],
  );

  const handleValuesChange = useCallback((_: any, all: BarcodeGlobalDefaults) => {
    setValues({ ...all });
  }, []);

  const handleSubmit = useCallback(async () => {
    const payload = await form.validateFields();
    if (!api) {
      message.error(t('API client is not available'));
      return;
    }
    setSaving(true);
    try {
      await saveGlobalDefaults(api, payload);
      message.success(t('Saved'));
    } catch (e: any) {
      message.error(e?.response?.data?.errors?.[0]?.message || e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [api, form, t]);

  const handleReset = useCallback(() => {
    form.setFieldsValue({ ...BUILT_IN_GLOBAL_DEFAULTS } as any);
    setValues({ ...BUILT_IN_GLOBAL_DEFAULTS });
  }, [form]);

  if (loading) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  return (
    <Card>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('These values are only the defaults')}
        description={t(
          'Each field can still override them in its own display settings. Barcodes are generated locally in the browser and the stored value is never modified.',
        )}
      />
      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Form
            form={form}
            layout="vertical"
            initialValues={values as any}
            onValuesChange={handleValuesChange}
            style={{ maxWidth: 520 }}
          >
            <Form.Item name="format" label={t('Symbology')}>
              <Select options={formatOptions} showSearch optionFilterProp="label" />
            </Form.Item>

            {!isQr && (
              <>
                <Form.Item name="barWidth" label={t('Bar width (px)')}>
                  <InputNumber min={1} max={10} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="barHeight" label={t('Bar height (px)')}>
                  <InputNumber min={10} max={300} step={5} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="displayValue" label={t('Show text under the bars')} valuePropName="checked">
                  <Switch />
                </Form.Item>
                {values.displayValue && (
                  <>
                    <Form.Item name="fontSize" label={t('Text size (px)')}>
                      <InputNumber min={6} max={48} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="textMargin" label={t('Text spacing (px)')}>
                      <InputNumber min={0} max={40} style={{ width: '100%' }} />
                    </Form.Item>
                  </>
                )}
              </>
            )}

            {isQr && (
              <>
                <Form.Item name="qrCellSize" label={t('Module size (px)')}>
                  <InputNumber min={1} max={20} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="qrErrorLevel" label={t('Error correction level')}>
                  <Select options={errorLevelOptions} />
                </Form.Item>
              </>
            )}

            <Form.Item name="margin" label={t('Quiet zone (px)')}>
              <InputNumber min={0} max={60} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="lineColor" label={t('Foreground colour')}>
              <BarcodeColorInput />
            </Form.Item>
            <Form.Item name="background" label={t('Background colour')}>
              <BarcodeColorInput allowTransparent />
            </Form.Item>

            <Divider />

            <Form.Item name="originalTextMode" label={t('Original text')}>
              <Select
                options={[
                  { value: 'none', label: t('Hidden') },
                  { value: 'inline', label: t('Next to the barcode') },
                  { value: 'below', label: t('Below the barcode') },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="fallbackToText"
              label={t('Fall back to the original text when the value cannot be encoded')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item name="clickToPreview" label={t('Click to enlarge')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="downloadable" label={t('Allow downloading the image')} valuePropName="checked">
              <Switch />
            </Form.Item>

            <Space>
              <Button type="primary" loading={saving} onClick={handleSubmit}>
                {t('Save')}
              </Button>
              <Button onClick={handleReset}>{t('Restore built-in defaults')}</Button>
            </Space>
          </Form>
        </Col>

        <Col xs={24} lg={10}>
          <Card size="small" title={t('Preview')} style={{ position: 'sticky', top: 16 }}>
            <div style={{ padding: 8, overflow: 'auto' }}>
              <BarcodeView value={sampleFor(values.format)} options={previewOptions} filename="preview" />
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default GlobalBarcodeSettingsPage;
