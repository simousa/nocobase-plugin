import React, { useMemo, useState } from 'react';
import { ActionModel, ActionSceneEnum } from '@nocobase/client-v2';
import { Button, Checkbox, Divider, Radio, Space } from 'antd';
import type { ButtonProps } from 'antd';
import { tExpr, useT } from '../locale';
import { buildColumnOptions, ColumnOption, resolvePrimaryKey, saveBlob } from '../utils';

type ExportScope = 'filtered' | 'all' | 'selected';

export class ExportEnhancedActionModel extends ActionModel {
  static scene = ActionSceneEnum.collection;

  defaultProps: ButtonProps = {
    children: tExpr('Export (Enhanced)'),
  };
}

ExportEnhancedActionModel.define({
  label: tExpr('Export (Enhanced)'),
  sort: 1040,
});

ExportEnhancedActionModel.registerFlow({
  key: 'exportEnhancedFlow',
  title: tExpr('Export (Enhanced)'),
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
        );
        const pk = resolvePrimaryKey(collection);

        ctx.viewer.dialog({
          title: ctx.t('Export (Enhanced)'),
          width: 560,
          content: (view: any) => (
            <ExportDialog
              options={options}
              pk={pk}
              hasSelection={(resource.getSelectedRows?.() || []).length > 0}
              onCancel={() => view.close()}
              onExport={async (columns: ColumnOption[], scope: ExportScope) => {
                let filter: any;
                if (scope === 'filtered') {
                  filter = resource.getFilter?.();
                } else if (scope === 'selected') {
                  const rows = resource.getSelectedRows?.() || [];
                  filter = { [pk]: { $in: rows.map((r: any) => r?.[pk]).filter((v: any) => v != null) } };
                }
                const data = await resource.runAction('exportEnhanced', {
                  method: 'post',
                  data: {
                    columns: columns.map(({ dataIndex, title }) => ({ dataIndex, title })),
                    filter,
                    sort: resource.getSort?.(),
                  },
                  responseType: 'blob',
                });
                saveBlob(data, `${ctx.t(collection.title || collection.name)}.xlsx`);
                ctx.message.success(ctx.t('Export started'));
                view.close();
              }}
            />
          ),
        });
      },
    },
  },
});

function ExportDialog({
  options,
  pk,
  hasSelection,
  onExport,
  onCancel,
}: {
  options: ColumnOption[];
  pk: string;
  hasSelection: boolean;
  onExport: (columns: ColumnOption[], scope: ExportScope) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>(options.map((o) => o.dataIndex));
  const [scope, setScope] = useState<ExportScope>('filtered');
  const [loading, setLoading] = useState(false);

  const columns = useMemo(() => options.filter((o) => selected.includes(o.dataIndex)), [options, selected]);

  const handleExport = async () => {
    if (!columns.length) return;
    setLoading(true);
    try {
      await onExport(columns, scope);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('Export scope')}</div>
      <Radio.Group value={scope} onChange={(e) => setScope(e.target.value)}>
        <Space direction="vertical">
          <Radio value="filtered">{t('Current filtered data')}</Radio>
          <Radio value="all">{t('All data of the collection')}</Radio>
          <Radio value="selected" disabled={!hasSelection}>
            {t('Selected rows')}
          </Radio>
        </Space>
      </Radio.Group>
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500 }}>{t('Export fields')}</span>
        <Space>
          <a onClick={() => setSelected(options.map((o) => o.dataIndex))}>{t('Select all')}</a>
          <a onClick={() => setSelected([pk])}>{t('Clear')}</a>
        </Space>
      </div>
      <Checkbox.Group
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 260, overflow: 'auto' }}
        value={selected}
        onChange={(v) => setSelected(v as string[])}
        options={options.map((o) => ({ label: o.title, value: o.dataIndex }))}
      />
      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
        {t('Tip: keep the primary key column ({{pk}}) if you plan to re-import with "Update" or "Overwrite" mode.', {
          pk,
        } as any)}
      </div>
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>{t('Cancel')}</Button>
          <Button type="primary" loading={loading} disabled={!columns.length} onClick={handleExport}>
            {t('Start export')}
          </Button>
        </Space>
      </div>
    </div>
  );
}
