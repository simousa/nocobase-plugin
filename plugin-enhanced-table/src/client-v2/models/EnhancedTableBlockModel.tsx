import React from 'react';
import { Table } from 'antd';
import { TableBlockModel } from '@nocobase/client-v2';
import type { Collection } from '@nocobase/flow-engine';
import { tExpr } from '../locale';
import { SelectionStatsView, StatKey } from '../components/SelectionStatsView';

const NUMERIC_TYPES = new Set([
  'integer',
  'bigInt',
  'float',
  'double',
  'decimal',
  'real',
  'number',
  'percent',
]);
const NUMERIC_INTERFACES = new Set(['integer', 'number', 'percent']);

const STAT_ORDER: StatKey[] = ['sum', 'average', 'max', 'min', 'count'];

const STAT_LABELS: Record<StatKey, string> = {
  sum: 'Sum',
  average: 'Average',
  max: 'Max',
  min: 'Min',
  count: 'Count',
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s\u00a5\uff04$€£%]/g, '');
    if (!/^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getByPath(record: any, path: string): unknown {
  if (!record) return undefined;
  if (!path.includes('.')) return record[path];
  return path.split('.').reduce((acc: any, key) => (acc == null ? acc : acc[key]), record);
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return rounded.toLocaleString();
  return Number(rounded.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function computeStat(stat: StatKey, values: number[]): number {
  if (stat === 'count') return values.length;
  if (!values.length) return 0;
  switch (stat) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    default:
      return 0;
  }
}

export class EnhancedTableBlockModel extends TableBlockModel {
  onMount() {
    super.onMount();
    // Inject an antd Table `summary` renderer. The base TableBlockModel already
    // forwards `model.props.summary` to the underlying antd Table, so the footer
    // row aligns perfectly with each column.
    this.setProps('summary', (pageData: any[]) => this.renderSummary(pageData));
  }

  private isNumericField(dataIndex?: string): boolean {
    if (!dataIndex) return false;
    const field: any = this.collection?.getField?.(dataIndex);
    if (!field) return false;
    if (NUMERIC_TYPES.has(field.type)) return true;
    const iface = field.options?.interface || field.interface;
    return !!iface && NUMERIC_INTERFACES.has(iface);
  }

  private getEnabledStats(): StatKey[] {
    const configured: StatKey[] = this.props.stats || STAT_ORDER;
    return STAT_ORDER.filter((s) => configured.includes(s));
  }

  renderSummary(pageData: any[]) {
    if (this.props.showFooter === false) return null;
    const stats = this.getEnabledStats();
    if (!stats.length || !pageData?.length) return null;

    const cols: any[] = (this as any).columns?.value?.length
      ? (this as any).columns.value
      : this.getColumns();
    if (!cols.length) return null;

    const t = (key: string) => this.translate(key);
    const rowSelection = this.isRowSelectionEnabled();
    const leftAux = rowSelection ? null : this.getLeftAuxiliaryColumn();
    const hasLeading = rowSelection || !!leftAux;

    // Precompute numeric column values once.
    const columnValues: Record<string, number[]> = {};
    cols.forEach((col) => {
      const di = col?.dataIndex;
      if (di && this.isNumericField(di)) {
        const values: number[] = [];
        pageData.forEach((record) => {
          const n = toNumber(getByPath(record, di));
          if (n !== null) values.push(n);
        });
        columnValues[di] = values;
      }
    });

    return (
      <Table.Summary fixed>
        {stats.map((stat) => {
          const label = t(STAT_LABELS[stat]);
          let idx = 0;
          let labelPlaced = false;
          const cells: React.ReactNode[] = [];

          if (hasLeading) {
            cells.push(
              <Table.Summary.Cell key="__leading__" index={idx++}>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
              </Table.Summary.Cell>,
            );
            labelPlaced = true;
          }

          cols.forEach((col, i) => {
            const di = col?.dataIndex;
            const numeric = di && Object.prototype.hasOwnProperty.call(columnValues, di);
            let content: React.ReactNode = null;
            if (numeric) {
              content = (
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {formatNum(computeStat(stat, columnValues[di]))}
                </span>
              );
            } else if (!labelPlaced) {
              content = <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>;
              labelPlaced = true;
            }
            cells.push(
              <Table.Summary.Cell key={col?.key ?? di ?? i} index={idx++} align="right">
                {content}
              </Table.Summary.Cell>,
            );
          });

          return <Table.Summary.Row key={stat}>{cells}</Table.Summary.Row>;
        })}
      </Table.Summary>
    );
  }

  renderComponent() {
    const inner = super.renderComponent();
    const showSelectionStats = this.props.showSelectionStats !== false;
    return (
      <SelectionStatsView enabled={showSelectionStats} stats={this.getEnabledStats()}>
        {inner}
      </SelectionStatsView>
    );
  }
}

EnhancedTableBlockModel.define({
  label: tExpr('Enhanced table'),
  group: tExpr('Content'),
  searchable: true,
  searchPlaceholder: tExpr('Search'),
  createModelOptions: () => ({
    use: 'EnhancedTableBlockModel',
    subModels: {
      columns: [
        {
          use: 'TableActionsColumnModel',
        },
      ],
    },
  }),
  sort: 310,
});

EnhancedTableBlockModel.registerFlow({
  key: 'enhancedTableSettings',
  sort: 550,
  title: tExpr('Enhanced table settings'),
  steps: {
    showFooter: {
      title: tExpr('Show footer summary row'),
      uiMode: { type: 'switch', key: 'showFooter' },
      defaultParams: {
        showFooter: true,
      },
      handler(ctx, params) {
        ctx.model.setProps('showFooter', params.showFooter);
      },
    },
    showSelectionStats: {
      title: tExpr('Show selection statistics'),
      uiMode: { type: 'switch', key: 'showSelectionStats' },
      defaultParams: {
        showSelectionStats: true,
      },
      handler(ctx, params) {
        ctx.model.setProps('showSelectionStats', params.showSelectionStats);
      },
    },
    stats: {
      title: tExpr('Statistics to display'),
      uiSchema: {
        stats: {
          type: 'array',
          title: tExpr('Statistics to display'),
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          'x-component-props': {
            mode: 'multiple',
            allowClear: true,
            placeholder: tExpr('Select statistics to display'),
          },
          enum: [
            { label: tExpr('Sum'), value: 'sum' },
            { label: tExpr('Average'), value: 'average' },
            { label: tExpr('Max'), value: 'max' },
            { label: tExpr('Min'), value: 'min' },
            { label: tExpr('Count'), value: 'count' },
          ],
        },
      },
      defaultParams: {
        stats: ['sum', 'average', 'max', 'min', 'count'],
      },
      handler(ctx, params) {
        ctx.model.setProps('stats', params.stats || []);
      },
    },
  },
});

export default EnhancedTableBlockModel;
