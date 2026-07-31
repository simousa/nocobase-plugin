import React, { useMemo } from 'react';
import { Select, Button, Space, Empty, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { observer, useFlowContext } from '@nocobase/flow-engine';
import { useT } from '../locale';
import type { StatKey } from './SelectionStatsView';

export type AggregationType = StatKey | 'none';

export interface FieldAggregation {
  field: string;
  stat: AggregationType;
}

export const STAT_OPTIONS: { label: string; value: AggregationType }[] = [
  { label: 'None', value: 'none' },
  { label: 'Sum', value: 'sum' },
  { label: 'Average', value: 'average' },
  { label: 'Max', value: 'max' },
  { label: 'Min', value: 'min' },
  { label: 'Count', value: 'count' },
];

// Best-effort extraction of a readable column label from an antd column prop.
// Column titles in NocoBase can be strings, React elements, or objects.
function getColumnLabel(col: any): string {
  if (!col) return '';
  const title = col.title;
  if (typeof title === 'string') return title;
  if (title == null) {
    const di = col.dataIndex;
    return Array.isArray(di) ? di.join('.') : di || '';
  }
  if (typeof title === 'number') return String(title);
  if (React.isValidElement(title)) {
    const children = (title.props as any)?.children;
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) {
      const text = children.find((c: any) => typeof c === 'string' || typeof c === 'number');
      if (text !== undefined) return String(text);
    }
  }
  const di = col.dataIndex;
  return Array.isArray(di) ? di.join('.') : di || '';
}

function getColumnValue(col: any): string {
  const di = col?.dataIndex;
  if (!di) return '';
  return Array.isArray(di) ? di.join('.') : di;
}

interface EditorProps {
  value?: FieldAggregation[];
  onChange?: (value: FieldAggregation[]) => void;
}

const FieldAggregationsEditorInner = observer<EditorProps>(({ value, onChange }) => {
  const t = useT();
  const ctx = useFlowContext() as any;
  const model = ctx?.model;

  const columnOptions = useMemo(() => {
    if (!model) return [];
    let cols: any[] = [];
    try {
      cols = (model.columns?.value?.length ? model.columns.value : model.getColumns?.()) || [];
    } catch {
      cols = [];
    }
    return cols
      .filter((c) => c && getColumnValue(c))
      .map((c) => ({ label: getColumnLabel(c) || getColumnValue(c), value: getColumnValue(c) }));
  }, [model]);

  const items: FieldAggregation[] = Array.isArray(value) ? value : [];
  const canEdit = typeof onChange === 'function';

  const update = (next: FieldAggregation[]) => {
    onChange?.(next);
  };

  const addItem = () => {
    // Pre-fill with the first unused field if available.
    const usedFields = new Set(items.map((it) => it.field));
    const firstUnused = columnOptions.find((o) => !usedFields.has(o.value));
    update([...items, { field: firstUnused?.value || '', stat: 'sum' }]);
  };

  const removeItem = (idx: number) => {
    update(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<FieldAggregation>) => {
    update(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const localizedStatOptions = STAT_OPTIONS.map((o) => ({ ...o, label: t(o.label) }));

  return (
    <div style={{ width: '100%' }}>
      {items.length === 0 && canEdit ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('No field aggregations configured')}
          style={{ margin: '8px 0' }}
        />
      ) : null}
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {items.map((item, idx) => (
          <Space key={idx} style={{ width: '100%', display: 'flex' }} size={8} align="center">
            <Select
              value={item.field || undefined}
              onChange={(v) => updateItem(idx, { field: v })}
              placeholder={t('Select field')}
              style={{ flex: 1, minWidth: 160 }}
              options={columnOptions}
              showSearch
              optionFilterProp="label"
              disabled={!canEdit}
              notFoundContent={columnOptions.length === 0 ? t('No available columns') : undefined}
            />
            <Select
              value={item.stat}
              onChange={(v) => updateItem(idx, { stat: v })}
              style={{ minWidth: 120 }}
              options={localizedStatOptions}
              disabled={!canEdit}
            />
            {canEdit && (
              <Tooltip title={t('Remove')}>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeItem(idx)}
                  disabled={!canEdit}
                />
              </Tooltip>
            )}
          </Space>
        ))}
        {canEdit && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} style={{ width: '100%' }} block>
            {t('Add field aggregation')}
          </Button>
        )}
      </Space>
    </div>
  );
});

// FlowSettings' registerComponentLoaders requires the resolved export to satisfy
// `typeof === "function"`. `observer()` returns a React.memo exotic component
// (typeof === "object"), which fails that check. Wrap it in a plain function
// component so the loader accepts it while preserving mobx reactivity inside.
function FieldAggregationsEditor(props: EditorProps): React.ReactElement {
  return React.createElement(FieldAggregationsEditorInner, props);
}

export { FieldAggregationsEditor };
export default FieldAggregationsEditor;
