/**
 * Tab page settings.
 *
 * Rendered at `/admin/settings/tab-page`. Shared verbatim by the v1 and v2
 * client lanes — it only depends on antd and `@nocobase/flow-engine`, both of
 * which behave identically in either lane.
 *
 * Two sections:
 *
 * 1. **Global defaults** (admin only) — edited by a user with the `pm.tab-page`
 *    snippet and persisted to the server.
 * 2. **My preferences** — every logged-in user may partially override the
 *    *look & close behaviour* in their own browser (`localStorage`). Disabled
 *    automatically when the administrator turns off `allowUserOverride`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Form, InputNumber, Row, Select, Space, Spin, Switch, message } from 'antd';
import { useFlowEngine } from '@nocobase/flow-engine';
import {
  MAX_TABS_LIMIT,
  TabPageGlobalConfig,
  TabPagePrefs,
  USER_OVERRIDABLE_KEYS,
} from '../../constants';
import {
  clearLocalPrefs,
  getEffectiveSettings,
  getGlobalConfig,
  loadGlobalConfig,
  saveGlobalConfig,
  setLocalPrefs,
} from '../tab-page/settings';
import { useT } from '../locale';

const tabSizeOptions = [
  { value: 'small', label: 'Small' },
  { value: 'middle', label: 'Medium' },
  { value: 'large', label: 'Large' },
];
const tabShapeOptions = [
  { value: 'card', label: 'Card' },
  { value: 'round', label: 'Rounded' },
  { value: 'line', label: 'Underline' },
];
const closeButtonOptions = [
  { value: 'always', label: 'Always visible' },
  { value: 'hover', label: 'On hover' },
  { value: 'active', label: 'Active tab only' },
];
const overflowOptions = [
  { value: 'closeOldest', label: 'Close the least recently used tab' },
  { value: 'blockNew', label: 'Refuse to open a new tab' },
];

export const TabPageSettingsPage: React.FC = () => {
  const t = useT();
  const engine = useFlowEngine();
  const api = (engine as any)?.context?.api ?? (engine as any)?.context?.apiClient;

  const [globalForm] = Form.useForm<TabPageGlobalConfig>();
  const [prefsForm] = Form.useForm<TabPagePrefs>();

  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [globalValues, setGlobalValues] = useState<TabPageGlobalConfig>(getGlobalConfig());
  const [allowOverride, setAllowOverride] = useState<boolean>(globalValues.allowUserOverride);

  useEffect(() => {
    let alive = true;
    (async () => {
      const next = api ? await loadGlobalConfig(api) : getGlobalConfig();
      if (!alive) return;
      globalForm.setFieldsValue(next);
      setGlobalValues(next);
      setAllowOverride(next.allowUserOverride);
      prefsForm.setFieldsValue(getEffectiveSettings());
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const handleGlobalSubmit = useCallback(async () => {
    const payload = await globalForm.validateFields();
    if (!api) {
      message.error(t('API client is not available'));
      return;
    }
    setSavingGlobal(true);
    try {
      await saveGlobalConfig(api, payload);
      const refreshed = getGlobalConfig();
      setGlobalValues(refreshed);
      setAllowOverride(refreshed.allowUserOverride);
      // The effective settings changed — refresh the prefs preview.
      prefsForm.setFieldsValue(getEffectiveSettings());
      message.success(t('Saved'));
    } catch (e: any) {
      message.error(e?.response?.data?.errors?.[0]?.message || e?.message || String(e));
    } finally {
      setSavingGlobal(false);
    }
  }, [api, globalForm, prefsForm, t]);

  const handlePrefsSubmit = useCallback(async () => {
    const payload = await prefsForm.validateFields();
    setSavingPrefs(true);
    try {
      setLocalPrefs(payload);
      prefsForm.setFieldsValue(getEffectiveSettings());
      message.success(t('Saved'));
    } catch (e: any) {
      message.error(e?.response?.data?.errors?.[0]?.message || e?.message || String(e));
    } finally {
      setSavingPrefs(false);
    }
  }, [prefsForm, t]);

  const handlePrefsReset = useCallback(() => {
    clearLocalPrefs();
    prefsForm.setFieldsValue(getEffectiveSettings());
    message.success(t('Reset to global defaults'));
  }, [prefsForm, t]);

  /** One `Form.Item` per key — bound to whichever `<Form>` it is rendered in. */
  const renderField = (key: keyof TabPageGlobalConfig) => {
    switch (key) {
      case 'enabled':
        return (
          <Form.Item
            key={key}
            name="enabled"
            valuePropName="checked"
            label={t('Enable tab mode')}
            extra={t('Open menus as tabs inside the current page instead of navigating away.')}
          >
            <Switch />
          </Form.Item>
        );
      case 'maxTabs':
        return (
          <Form.Item key={key} name="maxTabs" label={t('Maximum number of tabs')} extra={t('0 means unlimited.')}>
            <InputNumber min={0} max={MAX_TABS_LIMIT} style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'overflowStrategy':
        return (
          <Form.Item key={key} name="overflowStrategy" label={t('When the limit is reached')}>
            <Select options={overflowOptions} />
          </Form.Item>
        );
      case 'tabSize':
        return (
          <Form.Item key={key} name="tabSize" label={t('Tab size')}>
            <Select options={tabSizeOptions} />
          </Form.Item>
        );
      case 'tabShape':
        return (
          <Form.Item key={key} name="tabShape" label={t('Tab style')}>
            <Select options={tabShapeOptions} />
          </Form.Item>
        );
      case 'tabMaxWidth':
        return (
          <Form.Item key={key} name="tabMaxWidth" label={t('Maximum tab width (px)')}>
            <InputNumber min={60} max={400} style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'tabMinWidth':
        return (
          <Form.Item key={key} name="tabMinWidth" label={t('Minimum tab width (px)')}>
            <InputNumber min={40} max={400} style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'showIcon':
        return (
          <Form.Item key={key} name="showIcon" valuePropName="checked" label={t('Show menu icon')}>
            <Switch />
          </Form.Item>
        );
      case 'showRefreshButton':
        return (
          <Form.Item key={key} name="showRefreshButton" valuePropName="checked" label={t('Show refresh button')}>
            <Switch />
          </Form.Item>
        );
      case 'closeButtonVisibility':
        return (
          <Form.Item key={key} name="closeButtonVisibility" label={t('Close button')}>
            <Select options={closeButtonOptions} />
          </Form.Item>
        );
      case 'closeOnMiddleClick':
        return (
          <Form.Item key={key} name="closeOnMiddleClick" valuePropName="checked" label={t('Close with middle click')}>
            <Switch />
          </Form.Item>
        );
      case 'contextMenuEnabled':
        return (
          <Form.Item
            key={key}
            name="contextMenuEnabled"
            valuePropName="checked"
            label={t('Right-click menu')}
            extra={t('Show the batch-close menu when a tab is right-clicked.')}
          >
            <Switch />
          </Form.Item>
        );
      case 'pinHomeTab':
        return (
          <Form.Item
            key={key}
            name="pinHomeTab"
            valuePropName="checked"
            label={t('Pin the home tab')}
            extra={t('The first opened page can never be closed.')}
          >
            <Switch />
          </Form.Item>
        );
      case 'keepAtLeastOneTab':
        return (
          <Form.Item key={key} name="keepAtLeastOneTab" valuePropName="checked" label={t('Always keep at least one tab')}>
            <Switch />
          </Form.Item>
        );
      case 'destroyOnClose':
        return (
          <Form.Item
            key={key}
            name="destroyOnClose"
            valuePropName="checked"
            label={t('Destroy the page when the tab is closed')}
            extra={t('Frees memory immediately, but the page is rebuilt from scratch next time it is opened.')}
          >
            <Switch />
          </Form.Item>
        );
      case 'restoreTabsOnReload':
        return (
          <Form.Item key={key} name="restoreTabsOnReload" valuePropName="checked" label={t('Restore tabs after reload')}>
            <Switch />
          </Form.Item>
        );
      case 'allowUserOverride':
        return (
          <Form.Item
            key={key}
            name="allowUserOverride"
            valuePropName="checked"
            label={t('Allow users to override these settings')}
            extra={t('Users can then adjust the appearance and the close behaviour in their own browser.')}
          >
            <Switch />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  return (
    <Row gutter={24}>
      <Col xs={24} lg={12}>
        <Card title={t('Global defaults')} style={{ marginBottom: 24 }}>
          <Form form={globalForm} layout="vertical" initialValues={globalValues} style={{ maxWidth: 460 }}>
            <Divider orientation="left">{t('Capacity')}</Divider>
            {renderField('enabled')}
            {renderField('maxTabs')}
            {renderField('overflowStrategy')}

            <Divider orientation="left">{t('Appearance')}</Divider>
            {renderField('tabSize')}
            {renderField('tabShape')}
            {renderField('tabMaxWidth')}
            {renderField('tabMinWidth')}
            {renderField('showIcon')}
            {renderField('showRefreshButton')}

            <Divider orientation="left">{t('Close behaviour')}</Divider>
            {renderField('closeButtonVisibility')}
            {renderField('closeOnMiddleClick')}
            {renderField('contextMenuEnabled')}
            {renderField('pinHomeTab')}
            {renderField('keepAtLeastOneTab')}
            {renderField('destroyOnClose')}
            {renderField('restoreTabsOnReload')}
            {renderField('allowUserOverride')}

            <Space>
              <Button type="primary" loading={savingGlobal} onClick={handleGlobalSubmit}>
                {t('Save')}
              </Button>
            </Space>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={t('My preferences')} style={{ marginBottom: 24 }}>
          {allowOverride ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('Personal overrides are stored in this browser only.')}
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('The administrator has disabled personal overrides.')}
            />
          )}
          <Form form={prefsForm} layout="vertical" initialValues={getEffectiveSettings()} style={{ maxWidth: 460 }}>
            <Divider orientation="left">{t('Appearance')}</Divider>
            {USER_OVERRIDABLE_KEYS.map((key) => renderField(key as keyof TabPageGlobalConfig))}

            <Space>
              <Button type="primary" loading={savingPrefs} onClick={handlePrefsSubmit} disabled={!allowOverride}>
                {t('Save')}
              </Button>
              <Button onClick={handlePrefsReset} disabled={!allowOverride}>
                {t('Reset to global defaults')}
              </Button>
            </Space>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default TabPageSettingsPage;
