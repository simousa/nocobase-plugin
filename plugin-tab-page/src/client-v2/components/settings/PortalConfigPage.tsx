import React, { useEffect, useState } from 'react';
import {
  Form,
  Switch,
  Input,
  Select,
  Button,
  Card,
  Space,
  Alert,
  Tooltip,
  message,
} from 'antd';
import { PlusOutlined, MinusCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useFlowContext } from '@nocobase/flow-engine';
import { useAclSnippets } from '@nocobase/client-v2';
import { useT } from '../../locale';
import { MultiTabConfig } from '../../types';
import { TIP } from './tooltips';
import IconPicker from './IconPicker';
import { getPortalRecords, setPortalRecords, type PortalRecord } from '../../utils/portal';

interface PortalTabSet {
  defaultTabs: MultiTabConfig['defaultTabs'];
  pinnedTabs: MultiTabConfig['pinnedTabs'];
}

/**
 * Build an antd Form.Item validator for a tab path. A tab path must be non-empty and
 * start with "/". Portal identity is now resolved by NocoBase's own `portalName`, so the
 * tab path is just "where this tab navigates to" — no portal-scoped prefix is required.
 */
function makePathValidator(t: (s: string) => string) {
  return (_rule: unknown, value: string) => {
    if (!value || !value.trim()) {
      return Promise.reject(new Error(t('PathRequired')));
    }
    if (!value.trim().startsWith('/')) {
      return Promise.reject(new Error(t('PathMustStartWithSlash')));
    }
    return Promise.resolve();
  };
}

function TabListField({
  name,
  label,
  tipKey,
}: {
  name: string;
  label: string;
  tipKey: string;
}) {
  const t = useT();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 4, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{label}</span>
        {tipKey && (
          <Tooltip title={t(tipKey)}>
            <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }} />
          </Tooltip>
        )}
      </div>
      <Form.List name={name}>
        {(fields, { add, remove }) => (
          <div>
            {fields.map((field) => (
              <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                <Form.Item name={[field.name, 'title']} noStyle>
                  <Input placeholder={t('Title')} />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'path']}
                  noStyle
                  rules={[{ validator: makePathValidator(t) }]}
                >
                  <Input placeholder={t('Path')} />
                </Form.Item>
                <Form.Item name={[field.name, 'icon']} noStyle>
                  <IconPicker />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(field.name)} style={{ cursor: 'pointer' }} />
              </Space>
            ))}
            <Button
              type="dashed"
              onClick={() => add({ title: '', path: '', icon: '' })}
              block
              icon={<PlusOutlined />}
            >
              {t('Add')}
            </Button>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
              {t('tipIconHelper')}
            </div>
          </div>
        )}
      </Form.List>
    </div>
  );
}

export default function PortalConfigPage() {
  const { api } = useFlowContext();
  const t = useT();
  const { allow } = useAclSnippets();
  // Only users with `pm.multi-tabs.portal` (or legacy `pm.multi-tab.portal`) may write
  // the per-portal `portal_tab` column. Everyone else sees a permission notice.
  const canEditPortal = allow('pm.multi-tabs.portal');
  const [portalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Per-portal (门户) editing state. The portal-tab config is persisted to `portal_tab`
  // (NOT `options`), keyed by the NocoBase `portalName`, and governed by its own snippet.
  const [portalOptions, setPortalOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedPortal, setSelectedPortal] = useState<string>('');
  const [draftPortals, setDraftPortals] = useState<Record<string, PortalTabSet>>({});
  const [serverPortals, setServerPortals] = useState<Record<string, PortalTabSet>>({});

  const toOption = (it: PortalRecord) => ({
    value: it.portalName,
    label: it.title ? `${it.title} (${it.portalName})` : it.portalName,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.request({
        url: 'simoTabPageConfig:list',
        params: { pageSize: 1 },
      });
      const rows = res?.data?.data || [];
      const row = rows[0] || {};
      // This page edits ONLY the per-portal `portal_tab` blob.
      const portalTab = (row.portal_tab && row.portal_tab.portals) || {};
      setServerPortals(portalTab);
      setDraftPortals(portalTab);
      setSelectedPortal('');
      portalForm.setFieldsValue({ defaultTabs: [], pinnedTabs: [] });

      // Auto-read ALL portal records. Prefer the records already cached by the plugin
      // (loaded with skipAuth at startup, keyed by `portalName`), then refresh via the
      // `multiPortals:listEnabled` action so the dropdown is always populated even if the
      // per-page request happens to be permission-gated. This guarantees the admin can pick
      // any portal from the dropdown without a "use current portal" fallback button.
      const cached = getPortalRecords();
      if (cached.length) setPortalOptions(cached.map(toOption));
      try {
        const pres = await api.request({
          url: 'multiPortals:listEnabled',
          params: { pageSize: 200 },
        });
        const items = (pres?.data?.data || []) as any[];
        const records: PortalRecord[] = items.map((it: any) => ({
          uid: it.uid,
          portalName: it.portalName,
          routePath: it.routePath,
          title: it.title,
          enabled: it.enabled,
        }));
        // Keep the shared cache in sync so the runtime bar resolves the same keys.
        setPortalRecords(records);
        setPortalOptions(records.map(toOption));
      } catch {
        /* keep cache-based options if the live fetch is unavailable */
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persist the portal form's current default/pinned tabs into the draft for `fromKey`. */
  const commitPortalScope = (values: any, fromKey: string, draft: Record<string, PortalTabSet>) => {
    if (!fromKey) return draft;
    const set: PortalTabSet = {
      defaultTabs: values.defaultTabs || [],
      pinnedTabs: values.pinnedTabs || [],
    };
    return { ...draft, [fromKey]: set };
  };

  const handlePortalChange = (next: string) => {
    const values = portalForm.getFieldsValue(['defaultTabs', 'pinnedTabs']);
    const nextDraft = commitPortalScope(values, selectedPortal, draftPortals);
    setDraftPortals(nextDraft);
    setSelectedPortal(next);
    const entering = nextDraft[next] || serverPortals[next] || { defaultTabs: [], pinnedTabs: [] };
    portalForm.setFieldsValue({
      defaultTabs: entering.defaultTabs || [],
      pinnedTabs: entering.pinnedTabs || [],
    });
  };

  const onSavePortal = async () => {
    if (!selectedPortal) {
      message.warning(t('Select portal'));
      return;
    }
    const values = await portalForm.validateFields();
    setLoading(true);
    try {
      // Fold the currently-edited portal's tabs into the draft, then write the whole
      // `portals` map to `portal_tab` (a separate column, separate permission).
      const nextDraft = commitPortalScope(values, selectedPortal, draftPortals);
      setDraftPortals(nextDraft);
      const res = await api.request({
        url: 'simoTabPageConfig:updatePortal?forceUpdate=true',
        method: 'post',
        data: { portals: nextDraft },
      });
      const saved = (res as any)?.data?.portal_tab?.portals ?? nextDraft;
      setServerPortals(saved);
      message.success(t('Saved successfully'));
      window.dispatchEvent(new CustomEvent('simo:config-changed'));
    } catch (e: any) {
      message.error(e?.message || t('Save failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!canEditPortal) {
    return (
      <Card title={t('Portal default/fixed tabs')}>
        <Alert type="warning" message={t('No permission to configure portal tabs')} />
      </Card>
    );
  }

  return (
    <Card title={t('Portal default/fixed tabs')} loading={loading}>
      <Form form={portalForm} layout="vertical" initialValues={{ defaultTabs: [], pinnedTabs: [] }}>
        {/* Pick a portal from the auto-populated dropdown — no "use current portal" fallback. */}
        <Select
          value={selectedPortal}
          onChange={handlePortalChange}
          style={{ minWidth: 320 }}
          options={portalOptions}
          placeholder={t('Select portal')}
        />
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>
          {t('portalSelectHint')}
        </div>

        {/* Per-portal default/pinned tabs, stored in `portal_tab` (separate from `options`). */}
        <TabListField name="defaultTabs" label={t('Default tabs')} tipKey={TIP.defaultTabs} />
        <TabListField name="pinnedTabs" label={t('Pinned tabs')} tipKey={TIP.pinnedTabs} />

        <Button type="primary" loading={loading} onClick={onSavePortal} disabled={!selectedPortal}>
          {t('Save')}
        </Button>
      </Form>
    </Card>
  );
}
