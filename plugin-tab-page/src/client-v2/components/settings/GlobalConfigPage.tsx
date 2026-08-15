import React, { useEffect, useState } from 'react';
import {
  Form,
  Switch,
  InputNumber,
  Select,
  Slider,
  Button,
  Card,
  Space,
  Alert,
  Tooltip,
  message,
} from 'antd';
import { useFlowContext } from '@nocobase/flow-engine';
import { useAclSnippets } from '@nocobase/client-v2';
import { useT } from '../../locale';
import { DEFAULT_CONFIG, MultiTabConfig } from '../../types';
import { TIP } from './tooltips';

export default function GlobalConfigPage() {
  const { api } = useFlowContext();
  const t = useT();
  const { allow } = useAclSnippets();
  // The global default is gated by `pm.multi-tabs.global` (legacy `pm.multi-tab.global` also
  // accepted so existing role grants keep working through the rename). It writes `options`
  // ONLY — default/pinned tabs now live in the per-portal `portal_tab` column (configured on
  // the separate "Portal default/fixed tabs" page), so they are intentionally not part of
  // this page.
  const canEditGlobal = allow('pm.multi-tabs.global') || allow('pm.multi-tab.global');
  const [globalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const styleOptions = [
    { label: t('Card'), value: 'card' },
    { label: t('Rounded'), value: 'rounded' },
    { label: t('Underline'), value: 'underline' },
  ];
  const maxBehaviorOptions = [
    { label: t('Auto close least recently used'), value: 'lru' },
    { label: t('Stop opening new tabs'), value: 'block' },
  ];
  const closeButtonOptions = [
    { label: t('Always'), value: 'always' },
    { label: t('On hover'), value: 'hover' },
    { label: t('Only current tab'), value: 'active' },
  ];
  const closeButtonPositionOptions = [
    { label: t('Right, centered'), value: 'right-center' },
    { label: t('Top right corner'), value: 'top-right' },
  ];
  const barPositionOptions = [
    { label: t('Entire page'), value: 'page' },
    { label: t('Right of sidebar'), value: 'sidebar' },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.request({
        url: 'simoTabPageConfig:list',
        params: { pageSize: 1 },
      });
      const rows = res?.data?.data || [];
      const row = rows[0] || {};
      // `options` holds ONLY the global config (style, behavior, …). Default/pinned tabs are
      // portal-scoped now and live in `portal_tab`, so they are not loaded here.
      const options: Partial<MultiTabConfig> = row.options || DEFAULT_CONFIG;
      globalForm.setFieldsValue({ ...options });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveGlobal = async () => {
    const values = await globalForm.validateFields();
    setLoading(true);
    try {
      // `options` holds ONLY the global config. Never persist portal tabs inside `options`,
      // and default/pinned tabs are no longer part of the global config (they are portal-scoped).
      const opts: any = { ...values };
      delete opts.portals;
      delete opts.defaultTabs;
      delete opts.pinnedTabs;
      const res = await api.request({
        url: 'simoTabPageConfig:update?forceUpdate=true',
        method: 'post',
        data: opts,
      });
      message.success(t('Saved successfully'));
      window.dispatchEvent(new CustomEvent('simo:config-changed'));
    } catch (e: any) {
      message.error(e?.message || t('Save failed'));
    } finally {
      setLoading(false);
    }
  };

  // ---- Global default (writes `options`, gated by pm.multi-tabs.global) ----
  const globalCard = canEditGlobal ? (
    <Card title={t('Global default')} loading={loading}>
      <Form form={globalForm} layout="vertical" initialValues={DEFAULT_CONFIG}>
        <Form.Item name="enabled" label={t('Enabled')} valuePropName="checked" tooltip={t(TIP.enabled)}>
          <Switch />
        </Form.Item>
        <Form.Item
          name="allowPersonalization"
          label={t('Allow personalization')}
          valuePropName="checked"
          tooltip={t(TIP.allowPersonalization)}
        >
          <Switch />
        </Form.Item>

        <Form.Item name="maxTabs" label={t('Max tabs')} tooltip={t(TIP.maxTabs)}>
          <InputNumber min={0} />
        </Form.Item>
        <Form.Item name="maxBehavior" label={t('When reaching the limit')} tooltip={t(TIP.maxBehavior)}>
          <Select options={maxBehaviorOptions} />
        </Form.Item>

        <Form.Item name="style" label={t('Tab style')} tooltip={t(TIP.style)}>
          <Select options={styleOptions} />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(p, c) => p.style !== c.style}>
          {({ getFieldValue }) =>
            getFieldValue('style') === 'rounded' ? (
              <Form.Item name="roundedRadius" label={t('Corner radius')} tooltip={t(TIP.roundedRadius)}>
                <Slider min={0} max={16} />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item name="barPosition" label={t('Bar position')} tooltip={t(TIP.barPosition)}>
          <Select options={barPositionOptions} />
        </Form.Item>

        <Form.Item name="fixedWidth" label={t('Fixed width')} valuePropName="checked" tooltip={t(TIP.fixedWidth)}>
          <Switch />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(p, c) => p.fixedWidth !== c.fixedWidth}>
          {({ getFieldValue }) =>
            getFieldValue('fixedWidth') ? (
              <Form.Item name="fixedTabWidth" label={t('Fixed tab width')} tooltip={t(TIP.fixedTabWidth)}>
                <InputNumber min={40} max={600} addonAfter="px" />
              </Form.Item>
            ) : (
              <Space style={{ display: 'flex', gap: 16 }}>
                <Form.Item name="minTabWidth" label={t('Min tab width')} tooltip={t(TIP.minTabWidth)}>
                  <InputNumber min={40} max={600} addonAfter="px" />
                </Form.Item>
                <Form.Item name="maxTabWidth" label={t('Max tab width')} tooltip={t(TIP.maxTabWidth)}>
                  <InputNumber min={40} max={600} addonAfter="px" />
                </Form.Item>
              </Space>
            )
          }
        </Form.Item>
        <Form.Item name="tabHeight" label={t('Tab height')} tooltip={t(TIP.tabHeight)}>
          <InputNumber min={28} max={80} addonAfter="px" />
        </Form.Item>

        <Form.Item name="showMenuIcon" label={t('Show menu icons')} valuePropName="checked" tooltip={t(TIP.showMenuIcon)}>
          <Switch />
        </Form.Item>
        <Form.Item name="showRefresh" label={t('Show refresh button')} valuePropName="checked" tooltip={t(TIP.showRefresh)}>
          <Switch />
        </Form.Item>
        <Form.Item name="closeButtonMode" label={t('Show close button')} tooltip={t(TIP.closeButtonMode)}>
          <Select options={closeButtonOptions} />
        </Form.Item>
        <Form.Item name="closeButtonPosition" label={t('Close button position')} tooltip={t(TIP.closeButtonPosition)}>
          <Select options={closeButtonPositionOptions} />
        </Form.Item>
        <Form.Item name="middleClickClose" label={t('Middle-click to close')} valuePropName="checked" tooltip={t(TIP.middleClickClose)}>
          <Switch />
        </Form.Item>
        <Form.Item name="contextMenu" label={t('Right-click menu')} valuePropName="checked" tooltip={t(TIP.contextMenu)}>
          <Switch />
        </Form.Item>
        <Form.Item
          name="pinFirstTab"
          label={t('Pin first tab')}
          valuePropName="checked"
          tooltip={t(TIP.pinFirstTab)}
        >
          <Switch />
        </Form.Item>
        <Form.Item name="keepAtLeastOne" label={t('Keep at least one tab')} valuePropName="checked" tooltip={t(TIP.keepAtLeastOne)}>
          <Switch />
        </Form.Item>
        <Form.Item
          name="restoreAfterRefresh"
          label={t('Restore tabs after refresh')}
          valuePropName="checked"
          tooltip={t(TIP.restoreAfterRefresh)}
        >
          <Switch />
        </Form.Item>

        <Button type="primary" loading={loading} onClick={onSaveGlobal}>
          {t('Save')}
        </Button>
      </Form>
    </Card>
  ) : (
    <Card title={t('Global default')}>
      <Alert type="warning" message={t('No permission to configure global default')} />
    </Card>
  );

  return globalCard;
}
