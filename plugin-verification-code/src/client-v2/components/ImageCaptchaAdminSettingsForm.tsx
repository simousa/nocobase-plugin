import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Slider,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useApp } from '@nocobase/client-v2';

const PLUGIN_NS = '@simo/plugin-verification-code';

const DEFAULTS = {
  enableSignIn: false,
  enableSignUp: false,
  enableLostPassword: false,
  enablePublicForms: false,
  captchaType: 'characters',
  length: 4,
  charPreset: 'alphanumeric',
  excludeSimilar: true,
  mathOperator: '+-',
  mathMin: 1,
  mathMax: 20,
  noise: 3,
  color: true,
  background: '#f2f3f5',
  width: 150,
  height: 50,
  fontSize: 50,
  expiresIn: 300,
  rateLimitPerMinute: 30,
};

/**
 * Admin settings form for the `image-captcha` verification type.
 *
 * IMPORTANT: this component is rendered INSIDE the verification plugin's
 * `DrawerFormLayout`, which owns the antd `Form` instance and the submit
 * button. We only render `Form.Item`s whose value paths are nested under
 * `options` (e.g. `['options','captchaType']`), so the submitted `verifiers`
 * row gets `{ name, verificationType, options: { ... } }`.
 */
export default function ImageCaptchaAdminSettingsForm() {
  const app = useApp() as any;
  const t = (key: string, opts?: any) => app.i18n.t(key, { ns: [PLUGIN_NS, 'client'], ...opts });
  const form = Form.useFormInstance();
  const captchaType = Form.useWatch(['options', 'captchaType'], form);

  const [previewImg, setPreviewImg] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [engine, setEngine] = useState('');
  const previewTimer = useRef<any>(null);

  const doPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const all = form.getFieldsValue(true);
      const opts = all?.options || {};
      const res = await app.apiClient.request({ url: 'captcha:test', method: 'post', data: opts });
      const data = res?.data?.data;
      if (data?.image) setPreviewImg(data.image);
      if (data?.engine) setEngine(data.engine);
    } catch (err) {
      // ignore preview errors
    } finally {
      setPreviewLoading(false);
    }
  }, [app.apiClient, form]);

  const schedulePreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => doPreview(), 400);
  }, [doPreview]);

  useEffect(() => {
    doPreview();
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Typography.Title level={5}>{t('Where to enable')}</Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(
          'When enabled, the corresponding operation requires passing the captcha verification, which helps prevent bots from batch submissions.',
        )}
      />
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name={['options', 'enableSignIn']} label={t('Sign-in page')} valuePropName="checked" initialValue={DEFAULTS.enableSignIn}>
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={['options', 'enablePublicForms']} label={t('Public forms')} valuePropName="checked" initialValue={DEFAULTS.enablePublicForms}>
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={['options', 'enableSignUp']} label={t('Sign-up page')} valuePropName="checked" initialValue={DEFAULTS.enableSignUp}>
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={['options', 'enableLostPassword']} label={t('Forgot password page')} valuePropName="checked" initialValue={DEFAULTS.enableLostPassword}>
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <Typography.Title level={5}>{t('Captcha content')}</Typography.Title>
      <Form.Item name={['options', 'captchaType']} label={t('Captcha type')} initialValue={DEFAULTS.captchaType}>
        <Select
          options={[
            { value: 'characters', label: t('Characters (letters + digits)') },
            { value: 'math', label: t('Math expression') },
          ]}
        />
      </Form.Item>
      {captchaType !== 'math' && (
        <>
          <Form.Item
            name={['options', 'length']}
            label={t('Number of characters')}
            initialValue={DEFAULTS.length}
            extra={t('Verification is case-insensitive')}
          >
            <Slider min={4} max={8} marks={{ 4: '4', 5: '5', 6: '6', 7: '7', 8: '8' }} />
          </Form.Item>
          <Form.Item name={['options', 'charPreset']} label={t('Character set')} initialValue={DEFAULTS.charPreset}>
            <Select
              options={[
                { value: 'alphanumeric', label: t('Letters + digits') },
                { value: 'letters', label: t('Letters only') },
                { value: 'digits', label: t('Digits only') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name={['options', 'excludeSimilar']}
            label={t('Exclude confusing characters')}
            valuePropName="checked"
            initialValue={DEFAULTS.excludeSimilar}
            extra={t('Excludes easily-confused characters such as 0/o/O, 1/i/l/I')}
          >
            <Switch />
          </Form.Item>
        </>
      )}
      {captchaType === 'math' && (
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name={['options', 'mathOperator']} label={t('Operators')} initialValue={DEFAULTS.mathOperator}>
              <Select
                options={[
                  { value: '+-', label: t('Addition and subtraction') },
                  { value: '+', label: t('Addition only') },
                  { value: '-', label: t('Subtraction only') },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={['options', 'mathMin']} label={t('Min operand')} initialValue={DEFAULTS.mathMin}>
              <InputNumber min={0} max={99} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={['options', 'mathMax']} label={t('Max operand')} initialValue={DEFAULTS.mathMax}>
              <InputNumber min={1} max={99} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      )}

      <Divider />
      <Typography.Title level={5}>{t('Appearance')}</Typography.Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name={['options', 'noise']}
            label={t('Interference lines')}
            initialValue={DEFAULTS.noise}
            extra={t('More lines make it harder for OCR bots')}
          >
            <Slider min={0} max={10} marks={{ 0: '0', 5: '5', 10: '10' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={['options', 'color']} label={t('Colorful characters')} valuePropName="checked" initialValue={DEFAULTS.color}>
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}>
          <Form.Item name={['options', 'width']} label={t('Width (px)')} initialValue={DEFAULTS.width}>
            <InputNumber min={80} max={400} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name={['options', 'height']} label={t('Height (px)')} initialValue={DEFAULTS.height}>
            <InputNumber min={30} max={160} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name={['options', 'fontSize']} label={t('Font size')} initialValue={DEFAULTS.fontSize}>
            <InputNumber min={20} max={120} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name={['options', 'background']} label={t('Background color')} initialValue={DEFAULTS.background}>
            <Input placeholder="#f2f3f5" />
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <Typography.Title level={5}>{t('Security policy')}</Typography.Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name={['options', 'expiresIn']}
            label={t('Captcha expiry (seconds)')}
            initialValue={DEFAULTS.expiresIn}
            extra={t('The captcha becomes invalid after this time and must be refreshed')}
          >
            <InputNumber min={30} max={3600} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name={['options', 'rateLimitPerMinute']}
            label={t('Generation limit per IP per minute')}
            initialValue={DEFAULTS.rateLimitPerMinute}
            extra={t('Prevents bots from hammering the captcha endpoint')}
          >
            <InputNumber min={1} max={6000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <Card
        title={t('Live preview')}
        size="small"
        extra={
          engine ? (
            <Tag color={engine === 'svg-captcha' ? 'green' : 'orange'}>
              {engine === 'svg-captcha' ? t('Engine: svg-captcha (local)') : t('Engine: built-in (local)')}
            </Tag>
          ) : null
        }
      >
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <Tooltip title={t('Click to refresh')}>
            <div
              onClick={() => doPreview()}
              style={{
                display: 'inline-block',
                cursor: 'pointer',
                border: '1px solid #eee',
                borderRadius: 8,
                padding: 8,
                minWidth: 160,
                minHeight: 60,
              }}
            >
              {previewLoading && !previewImg ? (
                <Spin />
              ) : (
                previewImg && <img src={previewImg} alt="preview" style={{ maxWidth: '100%' }} draggable={false} />
              )}
            </div>
          </Tooltip>
          <div style={{ marginTop: 12 }}>
            <a onClick={() => doPreview()} style={{ cursor: 'pointer' }}>
              <ReloadOutlined /> {t('Refresh preview')}
            </a>
          </div>
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, textAlign: 'left' }}>
            {t('All captchas are generated locally on your server. No third-party API is called.')}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ textAlign: 'left' }}>
            {t(
              'Each captcha is one-time use: it is destroyed after the first verification attempt, and users can click the image to get a new one.',
            )}
          </Typography.Paragraph>
        </div>
      </Card>
    </div>
  );
}
