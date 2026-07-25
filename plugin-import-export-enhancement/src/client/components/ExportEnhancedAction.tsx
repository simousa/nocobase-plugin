import React, { useMemo, useState } from 'react';
import {
  useAPIClient,
  useBlockRequestContext,
  useCollection,
  useCompile,
  useDataSourceKey,
} from '@nocobase/client';
import { Button, Checkbox, Divider, Modal, Radio, Space } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import { useT } from '../locale-react';
import { buildColumnOptions, resolvePrimaryKey, saveBlob } from '../utils';

type ExportScope = 'filtered' | 'all';

export const ExportEnhancedAction: React.FC = () => {
  const t = useT();
  const api = useAPIClient();
  const compile = useCompile();
  const collection = useCollection();
  const dataSourceKey = useDataSourceKey();
  const blockCtx = useBlockRequestContext() as any;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<ExportScope>('filtered');

  const options = useMemo(
    () => buildColumnOptions(collection?.getFields?.() || [], compile),
    [collection, compile],
  );
  const pk = resolvePrimaryKey(collection);
  const [selected, setSelected] = useState<string[]>([]);
  const effectiveSelected = selected.length ? selected : options.map((o) => o.dataIndex);

  const handleExport = async () => {
    const columns = options
      .filter((o) => effectiveSelected.includes(o.dataIndex))
      .map(({ dataIndex, title }) => ({ dataIndex, title }));
    if (!columns.length) return;
    setLoading(true);
    try {
      const serviceParams = blockCtx?.service?.params?.[0] || {};
      const filter = scope === 'filtered' ? serviceParams.filter : undefined;
      const sort = serviceParams.sort;
      const headers = dataSourceKey && dataSourceKey !== 'main' ? { 'X-Data-Source': dataSourceKey } : undefined;
      const res = await api.request({
        url: `${collection.name}:exportEnhanced`,
        method: 'post',
        headers,
        data: { columns, filter, sort },
        responseType: 'blob',
      });
      saveBlob(res?.data, `${compile(collection.title) || collection.name}.xlsx`);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button icon={<CloudDownloadOutlined />} onClick={() => setOpen(true)}>
        {t('Export (Enhanced)')}
      </Button>
      <Modal
        title={t('Export (Enhanced)')}
        open={open}
        width={560}
        onCancel={() => setOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button type="primary" loading={loading} onClick={handleExport}>
              {t('Start export')}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('Export scope')}</div>
        <Radio.Group value={scope} onChange={(e) => setScope(e.target.value)}>
          <Space direction="vertical">
            <Radio value="filtered">{t('Current filtered data')}</Radio>
            <Radio value="all">{t('All data of the collection')}</Radio>
          </Space>
        </Radio.Group>
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500 }}>{t('Export fields')}</span>
          <a onClick={() => setSelected(options.map((o) => o.dataIndex))}>{t('Select all')}</a>
        </div>
        <Checkbox.Group
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 260, overflow: 'auto' }}
          value={effectiveSelected}
          onChange={(v) => setSelected(v as string[])}
          options={options.map((o) => ({ label: o.title, value: o.dataIndex }))}
        />
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          {t('Tip: keep the primary key column ({{pk}}) if you plan to re-import with "Update" or "Overwrite" mode.', {
            pk,
          })}
        </div>
      </Modal>
    </>
  );
};

export default ExportEnhancedAction;
