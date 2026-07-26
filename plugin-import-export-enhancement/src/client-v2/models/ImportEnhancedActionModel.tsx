import React, { useMemo, useState } from 'react';
import { ActionModel, ActionSceneEnum } from '@nocobase/client-v2';
import { Alert, Button, Checkbox, Divider, Radio, Space, Upload } from 'antd';
import type { ButtonProps, UploadFile } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { tExpr, useT } from '../locale';
import { buildColumnOptions, ColumnOption, resolvePrimaryKey, saveBlob } from '../utils';

type ImportMode = 'append' | 'update' | 'overwrite';

export class ImportEnhancedActionModel extends ActionModel {
  static scene = ActionSceneEnum.collection;

  defaultProps: ButtonProps = {
    // NOTE: must be `title` (not `children`) — see ExportEnhancedActionModel for details.
    title: tExpr('Import (Enhanced)'),
    icon: 'CloudUploadOutlined',
  };
}

ImportEnhancedActionModel.define({
  label: tExpr('Import (Enhanced)'),
  sort: 1050,
});

ImportEnhancedActionModel.registerFlow({
  key: 'importEnhancedFlow',
  title: tExpr('Import (Enhanced)'),
  on: 'click',
  steps: {
    open: {
      async handler(ctx: any) {
        const blockModel = ctx.blockModel || ctx.model?.context?.blockModel;
        const resource = blockModel?.resource;
        const collection = blockModel?.collection;
        if (!resource || !collection) return;

        const fields = typeof collection.getFields === 'function' ? collection.getFields() : [];
        const options = buildColumnOptions(
          Array.isArray(fields) ? fields : Array.from(fields?.values?.() || []),
          (s) => ctx.t(s),
        ).filter((o) => !o.isAssociation); // associations are not importable
        const pk = resolvePrimaryKey(collection);

        // Fields configured via the "Importable fields" menu item (x-action-settings.importSettings).
        const configured = (ctx.model?.schema?.['x-action-settings']?.importSettings || [])
          .map((f: any) => f?.dataIndex?.[0])
          .filter(Boolean);
        const defaultSelected = configured.length ? configured : options.map((o) => o.dataIndex);

        ctx.viewer.dialog({
          title: ctx.model?.getTitle?.() || ctx.t('Import (Enhanced)'),
          width: 640,
          content: (view: any) => (
            <ImportDialog
              options={options}
              pk={pk}
              defaultSelected={defaultSelected}
              onCancel={() => view.close()}
              onDownloadTemplate={async (columns: ColumnOption[]) => {
                const data = await resource.runAction('downloadImportTemplate', {
                  method: 'post',
                  data: { columns: columns.map(({ dataIndex, title }) => ({ dataIndex, title })) },
                  responseType: 'blob',
                });
                saveBlob(data, `${ctx.t(collection.title || collection.name)}-template.xlsx`);
              }}
              onImport={async (columns: ColumnOption[], mode: ImportMode, file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('columns', JSON.stringify(columns.map(({ dataIndex, title }) => ({ dataIndex, title }))));
                formData.append('mode', mode);
                if (mode === 'overwrite') {
                  const filter = resource.getFilter?.();
                  if (filter && Object.keys(filter).length) {
                    formData.append('filter', JSON.stringify(filter));
                  }
                }
                const result: any = await resource.runAction('importEnhanced', {
                  method: 'post',
                  data: formData,
                  timeout: 600000,
                });
                const stats = result?.data || result || {};
                ctx.message.success(
                  ctx.t('Import finished: {{created}} created, {{updated}} updated, {{skipped}} skipped', {
                    created: stats.created ?? 0,
                    updated: stats.updated ?? 0,
                    skipped: stats.skipped ?? 0,
                  }),
                );
                await resource.refresh?.();
                view.close();
              }}
            />
          ),
        });
      },
    },
  },
});

function ImportDialog({
  options,
  pk,
  defaultSelected,
  onDownloadTemplate,
  onImport,
  onCancel,
}: {
  options: ColumnOption[];
  pk: string;
  defaultSelected?: string[];
  onDownloadTemplate: (columns: ColumnOption[]) => Promise<void>;
  onImport: (columns: ColumnOption[], mode: ImportMode, file: File) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>(defaultSelected ?? options.map((o) => o.dataIndex));
  const [mode, setMode] = useState<ImportMode>('append');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const columns = useMemo(() => options.filter((o) => selected.includes(o.dataIndex)), [options, selected]);
  const file = fileList[0]?.originFileObj as File | undefined;

  const modeHints: Record<ImportMode, string> = {
    append: t('The primary key column in the sheet is ignored; every row is created as a new record.'),
    update: t('Rows are matched by primary key ({{pk}}); only the imported columns are updated.', { pk } as any),
    overwrite: t('Records in the current filter scope are deleted first, then rows from the sheet are created.'),
  };

  const handleImport = async () => {
    if (!columns.length || !file) return;
    setLoading(true);
    setError('');
    try {
      await onImport(columns, mode, file);
    } catch (err: any) {
      setError(err?.response?.data?.errors?.[0]?.message || err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('Import mode')}</div>
      <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
        <Radio.Button value="append">{t('Append')}</Radio.Button>
        <Radio.Button value="update">{t('Update')}</Radio.Button>
        <Radio.Button value="overwrite">{t('Overwrite')}</Radio.Button>
      </Radio.Group>
      <Alert style={{ marginTop: 8 }} type={mode === 'overwrite' ? 'warning' : 'info'} message={modeHints[mode]} showIcon />
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500 }}>{t('Import fields')}</span>
        <Space>
          <a onClick={() => setSelected(options.map((o) => o.dataIndex))}>{t('Select all')}</a>
          <a onClick={() => setSelected([])}>{t('Deselect all')}</a>
          <Button size="small" disabled={!columns.length} onClick={() => onDownloadTemplate(columns)}>
            {t('Download template')}
          </Button>
        </Space>
      </div>
      <Checkbox.Group
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflow: 'auto' }}
        value={selected}
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
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>{t('Cancel')}</Button>
          <Button type="primary" loading={loading} disabled={!columns.length || !file} onClick={handleImport}>
            {t('Start import')}
          </Button>
        </Space>
      </div>
    </div>
  );
}
