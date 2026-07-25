import React, { useMemo, useState } from 'react';
import {
  useAPIClient,
  useBlockRequestContext,
  useCollection,
  useCompile,
  useDataSourceKey,
} from '@nocobase/client';
import { Alert, Button, Checkbox, Divider, Modal, Radio, Space, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import { CloudUploadOutlined, InboxOutlined } from '@ant-design/icons';
import { useT } from '../locale-react';
import { buildColumnOptions, resolvePrimaryKey, saveBlob } from '../utils';

type ImportMode = 'append' | 'update' | 'overwrite';

export const ImportEnhancedAction: React.FC = () => {
  const t = useT();
  const api = useAPIClient();
  const compile = useCompile();
  const collection = useCollection();
  const dataSourceKey = useDataSourceKey();
  const blockCtx = useBlockRequestContext() as any;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ImportMode>('append');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [error, setError] = useState('');

  const options = useMemo(
    () => buildColumnOptions(collection?.getFields?.() || [], compile).filter((o) => !o.isAssociation),
    [collection, compile],
  );
  const pk = resolvePrimaryKey(collection);
  const [selected, setSelected] = useState<string[]>([]);
  const effectiveSelected = selected.length ? selected : options.map((o) => o.dataIndex);
  const columns = useMemo(
    () =>
      options
        .filter((o) => effectiveSelected.includes(o.dataIndex))
        .map(({ dataIndex, title }) => ({ dataIndex, title })),
    [options, effectiveSelected],
  );
  const file = fileList[0]?.originFileObj as File | undefined;
  const headers = dataSourceKey && dataSourceKey !== 'main' ? { 'X-Data-Source': dataSourceKey } : undefined;

  const modeHints: Record<ImportMode, string> = {
    append: t('The primary key column in the sheet is ignored; every row is created as a new record.'),
    update: t('Rows are matched by primary key ({{pk}}); only the imported columns are updated.', { pk }),
    overwrite: t('Records in the current filter scope are deleted first, then rows from the sheet are created.'),
  };

  const handleDownloadTemplate = async () => {
    if (!columns.length) return;
    const res = await api.request({
      url: `${collection.name}:downloadImportTemplate`,
      method: 'post',
      headers,
      data: { columns },
      responseType: 'blob',
    });
    saveBlob(res?.data, `${compile(collection.title) || collection.name}-template.xlsx`);
  };

  const handleImport = async () => {
    if (!columns.length || !file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('columns', JSON.stringify(columns));
      formData.append('mode', mode);
      if (mode === 'overwrite') {
        const filter = blockCtx?.service?.params?.[0]?.filter;
        if (filter && Object.keys(filter).length) {
          formData.append('filter', JSON.stringify(filter));
        }
      }
      const res = await api.request({
        url: `${collection.name}:importEnhanced`,
        method: 'post',
        headers,
        data: formData,
        timeout: 600000,
      });
      const stats = res?.data?.data || res?.data || {};
      message.success(
        t('Import finished: {{created}} created, {{updated}} updated, {{skipped}} skipped', {
          created: stats.created ?? 0,
          updated: stats.updated ?? 0,
          skipped: stats.skipped ?? 0,
        }),
      );
      setOpen(false);
      setFileList([]);
      await blockCtx?.service?.refresh?.();
    } catch (err: any) {
      setError(err?.response?.data?.errors?.[0]?.message || err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button icon={<CloudUploadOutlined />} onClick={() => setOpen(true)}>
        {t('Import (Enhanced)')}
      </Button>
      <Modal
        title={t('Import (Enhanced)')}
        open={open}
        width={640}
        onCancel={() => setOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button type="primary" loading={loading} disabled={!columns.length || !file} onClick={handleImport}>
              {t('Start import')}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('Import mode')}</div>
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
          <Radio.Button value="append">{t('Append')}</Radio.Button>
          <Radio.Button value="update">{t('Update')}</Radio.Button>
          <Radio.Button value="overwrite">{t('Overwrite')}</Radio.Button>
        </Radio.Group>
        <Alert
          style={{ marginTop: 8 }}
          type={mode === 'overwrite' ? 'warning' : 'info'}
          message={modeHints[mode]}
          showIcon
        />
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500 }}>{t('Import fields')}</span>
          <Space>
            <a onClick={() => setSelected(options.map((o) => o.dataIndex))}>{t('Select all')}</a>
            <Button size="small" disabled={!columns.length} onClick={handleDownloadTemplate}>
              {t('Download template')}
            </Button>
          </Space>
        </div>
        <Checkbox.Group
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflow: 'auto' }}
          value={effectiveSelected}
          onChange={(v) => setSelected(v as string[])}
          options={options.map((o) => ({ label: o.title, value: o.dataIndex }))}
        />
        <Divider style={{ margin: '12px 0' }} />
        <Upload.Dragger
          accept=".xlsx,.xls"
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
          onRemove={() => setFileList([])}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('Click or drag the xlsx file here')}</p>
        </Upload.Dragger>
        {error ? <Alert style={{ marginTop: 8 }} type="error" message={error} showIcon /> : null}
      </Modal>
    </>
  );
};

export default ImportEnhancedAction;
