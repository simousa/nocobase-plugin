import React, { useMemo, useState } from 'react';
import { Button, Popover, Input, Segmented, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import * as AntdIcons from '@ant-design/icons';
import { useT } from '../../locale';

type Theme = 'outlined' | 'filled' | 'twotone';

const THEME_SUFFIX: Record<Theme, string> = {
  outlined: 'Outlined',
  filled: 'Filled',
  twotone: 'TwoTone',
};

interface IconMeta {
  base: string;
  themes: Theme[];
}

/** Collect every icon base name (@ant-design/icons exposes Outlined / Filled / TwoTone variants). */
function collectIcons(): IconMeta[] {
  const map = new Map<string, Theme[]>();
  Object.keys(AntdIcons).forEach((name) => {
    const m = name.match(/^(.*?)(Outlined|Filled|TwoTone)$/);
    if (!m) return;
    const base = m[1];
    const theme = m[2].toLowerCase() as Theme;
    if (!map.has(base)) map.set(base, []);
    const arr = map.get(base)!;
    if (!arr.includes(theme)) arr.push(theme);
  });
  return Array.from(map.entries())
    .map(([base, themes]) => ({ base, themes }))
    .sort((a, b) => a.base.localeCompare(b.base));
}

/**
 * NocoBase-style icon picker (req #4): a button that opens a popover with a style
 * switcher (Outline / Filled / Two-tone), a search box, and a scrollable icon grid.
 * The selected value is the icon component name (e.g. "HomeOutlined"), which is exactly
 * what the tab renderer looks up via `(Icons as any)[name]`.
 */
export default function IconPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (v: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('outlined');
  const [search, setSearch] = useState('');
  const all = useMemo(() => collectIcons(), []);

  const currentTheme: Theme = useMemo(() => {
    if (!value) return 'outlined';
    if (value.endsWith('TwoTone')) return 'twotone';
    if (value.endsWith('Filled')) return 'filled';
    return 'outlined';
  }, [value]);

  const CurrentIcon = value ? (AntdIcons as any)[value] : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? all.filter((it) => it.base.toLowerCase().includes(q)) : all;
    // Only show bases that actually have the selected theme variant.
    return list.filter((it) => it.themes.includes(theme));
  }, [all, search, theme]);

  const pick = (base: string) => {
    const name = `${base}${THEME_SUFFIX[theme]}`;
    onChange?.(name);
    setOpen(false);
  };

  const content = (
    <div style={{ width: 332 }}>
      <Input
        prefix={<SearchOutlined />}
        placeholder={t('Search icons')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 8 }}
      />
      <Segmented
        value={theme}
        onChange={(v) => setTheme(v as Theme)}
        options={[
          { label: t('Outline'), value: 'outlined' },
          { label: t('Filled'), value: 'filled' },
          { label: t('Two-tone'), value: 'twotone' },
        ]}
        style={{ marginBottom: 8 }}
      />
      <div
        style={{
          maxHeight: 264,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('No matching icon')} />
          </div>
        ) : (
          filtered.map((it) => {
            const name = `${it.base}${THEME_SUFFIX[theme]}`;
            const Cmp = (AntdIcons as any)[name];
            if (!Cmp) return null;
            const active = value === name;
            return (
              <div
                key={it.base}
                title={name}
                onClick={() => pick(it.base)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 36,
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontSize: 18,
                  background: active ? '#e6f4ff' : 'transparent',
                  border: active ? '1px solid #91caff' : '1px solid transparent',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = active ? '#e6f4ff' : '#f5f5f5')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = active ? '#e6f4ff' : 'transparent')
                }
              >
                <Cmp />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      <Button type="dashed" style={{ width: 180 }}>
        {CurrentIcon ? <CurrentIcon style={{ marginRight: 6 }} /> : null}
        {value || t('Select icon')}
      </Button>
    </Popover>
  );
}
