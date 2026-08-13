import React, { useEffect, useRef, useState } from 'react';
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
  message,
} from 'antd';
import { useFlowContext } from '@nocobase/flow-engine';
import { useAclSnippets } from '@nocobase/client-v2';
import { useT } from '../../locale';
import { DEFAULT_CONFIG, MultiTabConfig, normalizeConfig } from '../../types';
import { loadPersonalConfig, savePersonalConfig, clearPersonalConfig, setPortalKey } from '../../utils/config';
import { getPortalKey } from '../../utils/portal';
import { TIP, PERSONAL_NOTE } from './tooltips';

export default function PersonalConfigPage() {
  const { api } = useFlowContext();
  const t = useT();
  const { allow } = useAclSnippets();
  const canEdit = allow('pm.multi-tabs.personal') || allow('pm.multi-tab.personal');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [personalizationAllowed, setPersonalizationAllowed] = useState(true);
  // When the global config seeds initial tabs, "pin first tab" has no effect (req #2),
  // so the personal control is disabled to avoid a misleading toggle.
  const [hasGlobalInitial, setHasGlobalInitial] = useState(false);
  // Real global default fetched from the server — used to seed the form (req #2)
  // and as the base when saving / resetting personal prefs.
  const globalCfgRef = useRef<MultiTabConfig>(DEFAULT_CONFIG);

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
  const barPositionOptions = [
    { label: t('Entire page'), value: 'page' },
    { label: t('Right of sidebar'), value: 'sidebar' },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      let globalOptions = DEFAULT_CONFIG;
      try {
        const res = await api.request({
          url: 'simoTabPageConfig:list',
          params: { pageSize: 1, _t: Date.now() },
        });
        const rows = res?.data?.data || [];
        // Seed from the *real* global default (not the hardcoded DEFAULT_CONFIG), so
        // personal prefs start as a complete copy of the admin's global settings (req #2).
        if (rows.length && rows[0].options) globalOptions = normalizeConfig(rows[0].options);
      } catch {
        /* ignore — fall back to code defaults */
      }
      if (!mounted) return;
      setPersonalizationAllowed(globalOptions.allowPersonalization !== false);
      setHasGlobalInitial(
        (globalOptions.pinnedTabs?.length || 0) > 0 || (globalOptions.defaultTabs?.length || 0) > 0,
      );
      globalCfgRef.current = globalOptions;
      // Scope personal prefs to the CURRENT portal so they never bleed across portals
      // (req #2). The bar applies the same key, so the prefs line up per portal.
      setPortalKey(getPortalKey());
      const personal = loadPersonalConfig();
      form.setFieldsValue({ ...globalOptions, ...personal });
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canEdit) {
    return (
      <Card>
        <Alert
          type="warning"
          message={t('No permission to configure personal preferences')}
        />
      </Card>
    );
  }

  if (!personalizationAllowed) {
    return (
      <Card title={t('Personal preferences')}>
        <Alert type="info" message={t('Personalization is disabled by the administrator')} />
      </Card>
    );
  }

  const onSave = async () => {
    const values = (await form.validateFields()) as Partial<MultiTabConfig>;
    setLoading(true);
    try {
      // Store the global default merged with the user's overrides so the personal
      // object contains every config key (req #2) instead of only a sparse subset.
      // `portals` is admin-controlled and must NOT be persisted as a personal pref.
      const toSave = { ...globalCfgRef.current, ...values } as Partial<MultiTabConfig>;
      delete (toSave as any).portals;
      savePersonalConfig(toSave);
      message.success(t('Saved successfully'));
      window.dispatchEvent(new CustomEvent('simo:config-changed'));
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    clearPersonalConfig();
    // Reset back to the current global default (req #2), not the code default.
    form.setFieldsValue(globalCfgRef.current);
    message.success(t('Reset to global default'));
    window.dispatchEvent(new CustomEvent('simo:config-changed'));
  };

  return (
    <Card title={t('Personal preferences')}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(PERSONAL_NOTE)}
      />
      <Form form={form} layout="vertical" initialValues={DEFAULT_CONFIG}>
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
        <Form.Item name="barPosition" label={t('Bar position')} tooltip={t(TIP.barPosition)}>
          <Select options={barPositionOptions} />
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
        <Form.Item name="middleClickClose" label={t('Middle-click to close')} valuePropName="checked" tooltip={t(TIP.middleClickClose)}>
          <Switch />
        </Form.Item>
        <Form.Item name="contextMenu" label={t('Right-click menu')} valuePropName="checked" tooltip={t(TIP.contextMenu)}>
          <Switch />
        </Form.Item>
        <Form.Item name="pinFirstTab" label={t('Pin first tab')} valuePropName="checked" tooltip={t(TIP.pinFirstTab)}>
          <Switch disabled={hasGlobalInitial} />
        </Form.Item>
        {hasGlobalInitial && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('pinFirstTabDisabledNote')}
          />
        )}
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

        <Space>
          <Button type="primary" loading={loading} onClick={onSave}>
            {t('Save')}
          </Button>
          <Button onClick={onReset}>{t('Reset to global default')}</Button>
        </Space>
      </Form>
    </Card>
  );
}
