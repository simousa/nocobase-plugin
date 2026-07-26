import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SchemaComponent, useAPIClient, FormItem } from '@nocobase/client';
// IMPORTANT: `useForm` (Formily hook) must come from `@formily/react`, NOT from
// `@nocobase/client` — the v1 lane's `@nocobase/client` does not re-export it
// (the official verification plugin imports it from `@formily/react` too). The
// v1 client build externalizes `@formily/react`, so this resolves to the app's
// single Formily instance and shares the verification drawer's form context.
import { useForm } from '@formily/react';
import {
  Alert,
  Card,
  Divider,
  Spin,
  Switch,
  Select,
  Slider,
  Input,
  InputNumber,
  Tag,
  Typography,
  Tooltip,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

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

const COMPONENTS = { FormItem, Switch, Select, Slider, Input, InputNumber };

// ---- schema field builders (all fields are written under options.*) ----
function boolField(title: string, dflt: boolean, desc?: string) {
  return {
    type: 'boolean',
    'x-decorator': 'FormItem',
    title,
    'x-component': 'Switch',
    default: dflt,
    ...(desc ? { description: desc } : {}),
  };
}

function strField(title: string, dflt: string, props: Record<string, any>) {
  return {
    type: 'string',
    'x-decorator': 'FormItem',
    title,
    'x-component': 'Select',
    default: dflt,
    'x-component-props': props,
  };
}

function numField(title: string, dflt: number, props: Record<string, any>, desc?: string) {
  return {
    type: 'number',
    'x-decorator': 'FormItem',
    title,
    'x-component': 'InputNumber',
    default: dflt,
    'x-component-props': { style: { width: '100%' }, ...props },
    ...(desc ? { description: desc } : {}),
  };
}

function numSlider(title: string, dflt: number, props: Record<string, any>, desc?: string) {
  return {
    type: 'number',
    'x-decorator': 'FormItem',
    title,
    'x-component': 'Slider',
    default: dflt,
    'x-component-props': props,
    ...(desc ? { description: desc } : {}),
  };
}

function divider() {
  return { type: 'void', 'x-component': 'Divider' };
}

/**
 * Admin settings form for the `image-captcha` verification type (legacy v1
 * `@nocobase/client` lane).
 *
 * This component is rendered INSIDE the verification plugin's `Settings`
 * drawer, which is the `x-component` of the verifier record's `options`
 * field. Formily scopes any `SchemaComponent` rendered here so its field
 * paths live under `options.*` automatically (e.g. `options.captchaType`).
 * That matches how the official SMS `AdminSettingsForm` works.
 *
 * It is Formily-based only (uses `useForm` from `@formily/react`) and never
 * imports `@nocobase/client-v2` — so it runs safely in the v1 lane.
 */
export default function ImageCaptchaAdminSettingsForm() {
  const api: any = useAPIClient();
  const app: any = api?.app || api;
  const t = (key: string, opts?: any) =>
    app?.i18n ? app.i18n.t(key, { ns: [PLUGIN_NS, 'client'], ...opts }) : key;
  const form: any = useForm();

  const [previewImg, setPreviewImg] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [engine, setEngine] = useState('');
  const [type, setType] = useState<string>((form?.values?.options?.captchaType as string) || 'characters');
  const previewTimer = useRef<any>(null);

  const getOpts = useCallback(() => {
    const o = form?.values?.options;
    return o ? JSON.parse(JSON.stringify(o)) : {};
  }, [form]);

  const doPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const opts = getOpts();
      const res = await api.request({ url: 'captcha:test', method: 'post', data: opts });
      const data = res?.data?.data;
      if (data?.image) setPreviewImg(data.image);
      if (data?.engine) setEngine(data.engine);
    } catch (err) {
      // preview errors are non-fatal
    } finally {
      setPreviewLoading(false);
    }
  }, [api, getOpts]);

  const schedulePreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => doPreview(), 400);
  }, [doPreview]);

  // Re-render on captchaType changes (to swap char/math sections) and refresh
  // the live preview whenever any option changes.
  useEffect(() => {
    doPreview();
    const dispose = form?.subscribe?.(() => {
      const v = (form.values?.options?.captchaType as string) || 'characters';
      setType(v);
      schedulePreview();
    });
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      if (dispose) dispose();
    };
  }, [form, doPreview, schedulePreview]);

  const tVal = (k: string) => t(k);

  const enableSection = {
    type: 'void',
    properties: {
      enableSignIn: boolField(tVal('Sign-in page'), DEFAULTS.enableSignIn),
      enablePublicForms: boolField(tVal('Public forms'), DEFAULTS.enablePublicForms),
      enableSignUp: boolField(tVal('Sign-up page'), DEFAULTS.enableSignUp),
      enableLostPassword: boolField(tVal('Forgot password page'), DEFAULTS.enableLostPassword),
    },
  };

  const contentSection =
    type !== 'math'
      ? {
          type: 'void',
          properties: {
            captchaType: strField(tVal('Captcha type'), DEFAULTS.captchaType, {
              options: [
                { value: 'characters', label: tVal('Characters (letters + digits)') },
                { value: 'math', label: tVal('Math expression') },
              ],
            }),
            length: numSlider(
              tVal('Number of characters'),
              DEFAULTS.length,
              { min: 4, max: 8, marks: { 4: '4', 5: '5', 6: '6', 7: '7', 8: '8' } },
              tVal('Verification is case-insensitive'),
            ),
            charPreset: strField(tVal('Character set'), DEFAULTS.charPreset, {
              options: [
                { value: 'alphanumeric', label: tVal('Letters + digits') },
                { value: 'letters', label: tVal('Letters only') },
                { value: 'digits', label: tVal('Digits only') },
              ],
            }),
            excludeSimilar: boolField(
              tVal('Exclude confusing characters'),
              DEFAULTS.excludeSimilar,
              tVal('Excludes easily-confused characters such as 0/o/O, 1/i/l/I'),
            ),
          },
        }
      : {
          type: 'void',
          properties: {
            captchaType: strField(tVal('Captcha type'), DEFAULTS.captchaType, {
              options: [
                { value: 'characters', label: tVal('Characters (letters + digits)') },
                { value: 'math', label: tVal('Math expression') },
              ],
            }),
            mathOperator: strField(tVal('Operators'), DEFAULTS.mathOperator, {
              options: [
                { value: '+-', label: tVal('Addition and subtraction') },
                { value: '+', label: tVal('Addition only') },
                { value: '-', label: tVal('Subtraction only') },
              ],
            }),
            mathMin: numField(tVal('Min operand'), DEFAULTS.mathMin, { min: 0, max: 99 }),
            mathMax: numField(tVal('Max operand'), DEFAULTS.mathMax, { min: 1, max: 99 }),
          },
        };

  const appearanceSection = {
    type: 'void',
    properties: {
      noise: numSlider(
        tVal('Interference lines'),
        DEFAULTS.noise,
        { min: 0, max: 10, marks: { 0: '0', 5: '5', 10: '10' } },
        tVal('More lines make it harder for OCR bots'),
      ),
      color: boolField(tVal('Colorful characters'), DEFAULTS.color),
      width: numField(tVal('Width (px)'), DEFAULTS.width, { min: 80, max: 400 }),
      height: numField(tVal('Height (px)'), DEFAULTS.height, { min: 30, max: 160 }),
      fontSize: numField(tVal('Font size'), DEFAULTS.fontSize, { min: 20, max: 120 }),
      background: strField(tVal('Background color'), DEFAULTS.background, { placeholder: '#f2f3f5' }),
    },
  };

  const securitySection = {
    type: 'void',
    properties: {
      expiresIn: numField(
        tVal('Captcha expiry (seconds)'),
        DEFAULTS.expiresIn,
        { min: 30, max: 3600 },
        tVal('The captcha becomes invalid after this time and must be refreshed'),
      ),
      rateLimitPerMinute: numField(
        tVal('Generation limit per IP per minute'),
        DEFAULTS.rateLimitPerMinute,
        { min: 1, max: 6000 },
        tVal('Prevents bots from hammering the captcha endpoint'),
      ),
    },
  };

  return (
    <div>
      <Typography.Title level={5}>{tVal('Where to enable')}</Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(
          'When enabled, the corresponding operation requires passing the captcha verification, which helps prevent bots from batch submissions.',
        )}
      />
      <SchemaComponent schema={enableSection} components={COMPONENTS} />

      <Divider />
      <Typography.Title level={5}>{tVal('Captcha content')}</Typography.Title>
      <SchemaComponent schema={contentSection} components={COMPONENTS} />

      <Divider />
      <Typography.Title level={5}>{tVal('Appearance')}</Typography.Title>
      <SchemaComponent schema={appearanceSection} components={COMPONENTS} />

      <Divider />
      <Typography.Title level={5}>{tVal('Security policy')}</Typography.Title>
      <SchemaComponent schema={securitySection} components={COMPONENTS} />

      <Divider />
      <Card
        title={tVal('Live preview')}
        size="small"
        extra={
          engine ? (
            <Tag color={engine === 'svg-captcha' ? 'green' : 'orange'}>
              {engine === 'svg-captcha' ? tVal('Engine: svg-captcha (local)') : tVal('Engine: built-in (local)')}
            </Tag>
          ) : null
        }
      >
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <Tooltip title={tVal('Click to refresh')}>
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
              ) : previewImg ? (
                <img src={previewImg} alt="preview" style={{ maxWidth: '100%' }} draggable={false} />
              ) : null}
            </div>
          </Tooltip>
          <div style={{ marginTop: 12 }}>
            <a onClick={() => doPreview()} style={{ cursor: 'pointer' }}>
              <ReloadOutlined /> {tVal('Refresh preview')}
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
