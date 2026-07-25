import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
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
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useFlowContext } from '@nocobase/flow-engine';
import { useT } from '../locale';

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

export default function CaptchaSettingsPage() {
  const ctx = useFlowContext();
  const t = useT();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [previewImg, setPreviewImg] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [engine, setEngine] = useState('');
  const previewTimer = useRef<any>(null);

  const captchaType = Form.useWatch('captchaType', form);

  const doPreview = useCallback(
    async (values?: any) => {
      setPreviewLoading(true);
      try {
        const current = { ...form.getFieldsValue(), ...(values || {}) };
        const res = await ctx.api.request({ url: 'captcha:test', method: 'post', data: current });
        const data = res?.data?.data;
        if (data?.image) setPreviewImg(data.image);
        if (data?.engine) setEngine(data.engine);
      } catch (err) {
        // ignore preview errors
      } finally {
        setPreviewLoading(false);
      }
    },
    [ctx.api, form],
  );

  const schedulePreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => doPreview(), 400);
  }, [doPreview]);

  useEffect(() => {
    (async () => {
      try {
        const res = await ctx.api.request({
          url: 'captchaSettings:list',
          method: 'get',
          params: { pageSize: 1, sort: 'id' },
        });
        const rec = res?.data?.data?.[0];
        if (rec) {
          setRecordId(rec.id);
          form.setFieldsValue({ ...DEFAULTS, ...rec });
        } else {
          form.setFieldsValue(DEFAULTS);
        }
      } catch (err) {
        form.setFieldsValue(DEFAULTS);
      } finally {
        setLoading(false);
        doPreview();
      }
    })();
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (recordId != null) {
        await ctx.api.request({
          url: `captchaSettings:update?filterByTk=${recordId}`,
          method: 'post',
          data: values,
        });
      } else {
        const res = await ctx.api.request({ url: 'captchaSettings:create', method: 'post', data: values });
        const created = res?.data?.data;
        if (created?.id) setRecordId(created.id);
      }
      ctx.message.success(t('Saved successfully'));
    } catch (err: any) {
      if (err?.errorFields) return; // form validation error
      ctx.message.error(err?.response?.data?.errors?.[0]?.message || String(err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  return (
    <Row gutter={24}>
      <Col xs={24} lg={15}>
        <Card>
          <Form form={form} layout="vertical" onValuesChange={schedulePreview} initialValues={DEFAULTS}>
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
                <Form.Item name="enableSignIn" label={t('Sign-in page')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="enablePublicForms" label={t('Public forms')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="enableSignUp" label={t('Sign-up page')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="enableLostPassword" label={t('Forgot password page')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Typography.Title level={5}>{t('Captcha content')}</Typography.Title>
            <Form.Item name="captchaType" label={t('Captcha type')}>
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
                  name="length"
                  label={t('Number of characters')}
                  extra={t('Verification is case-insensitive')}
                >
                  <Slider min={4} max={8} marks={{ 4: '4', 5: '5', 6: '6', 7: '7', 8: '8' }} />
                </Form.Item>
                <Form.Item name="charPreset" label={t('Character set')}>
                  <Select
                    options={[
                      { value: 'alphanumeric', label: t('Letters + digits') },
                      { value: 'letters', label: t('Letters only') },
                      { value: 'digits', label: t('Digits only') },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="excludeSimilar"
                  label={t('Exclude confusing characters')}
                  valuePropName="checked"
                  extra={t('Excludes easily-confused characters such as 0/o/O, 1/i/l/I')}
                >
                  <Switch />
                </Form.Item>
              </>
            )}
            {captchaType === 'math' && (
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="mathOperator" label={t('Operators')}>
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
                  <Form.Item name="mathMin" label={t('Min operand')}>
                    <InputNumber min={0} max={99} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="mathMax" label={t('Max operand')}>
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
                  name="noise"
                  label={t('Interference lines')}
                  extra={t('More lines make it harder for OCR bots')}
                >
                  <Slider min={0} max={10} marks={{ 0: '0', 5: '5', 10: '10' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="color" label={t('Colorful characters')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="width" label={t('Width (px)')}>
                  <InputNumber min={80} max={400} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="height" label={t('Height (px)')}>
                  <InputNumber min={30} max={160} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="fontSize" label={t('Font size')}>
                  <InputNumber min={20} max={120} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="background" label={t('Background color')}>
                  <Input placeholder="#f2f3f5" />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Typography.Title level={5}>{t('Security policy')}</Typography.Title>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="expiresIn"
                  label={t('Captcha expiry (seconds)')}
                  extra={t('The captcha becomes invalid after this time and must be refreshed')}
                >
                  <InputNumber min={30} max={3600} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="rateLimitPerMinute"
                  label={t('Generation limit per IP per minute')}
                  extra={t('Prevents bots from hammering the captcha endpoint')}
                >
                  <InputNumber min={1} max={6000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
              {t('Save')}
            </Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={9}>
        <Card
          title={t('Live preview')}
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
              <Button size="small" icon={<ReloadOutlined />} onClick={() => doPreview()} loading={previewLoading}>
                {t('Refresh preview')}
              </Button>
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
      </Col>
    </Row>
  );
}
