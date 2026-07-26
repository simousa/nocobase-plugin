import {
  SchemaSettings,
  ButtonEditor,
  SchemaSettingsLinkageRules,
  useSchemaToolbar,
  useDesignable,
  useCollection,
  useCompile,
} from '@nocobase/client';
import { useFieldSchema } from '@formily/react';
import { FormItem } from '@formily/antd-v5';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { useT } from './locale-react';
import { buildColumnOptions } from './utils';

/** Build the `useComponentProps` for the "Exportable fields" / "Importable fields" menu item. */
function useConfigurableFieldsProps(kind: 'export' | 'import') {
  const fieldSchema = useFieldSchema() as any;
  const { dn } = useDesignable();
  const collection = useCollection();
  const compile = useCompile();
  const t = useT();

  const options = buildColumnOptions(collection?.getFields?.() || [], compile)
    .filter((o) => (kind === 'import' ? !o.isAssociation : true))
    .map((o) => ({ label: o.title, value: o.dataIndex }));

  const settingsKey = kind === 'export' ? 'exportSettings' : 'importSettings';
  const existing = (fieldSchema?.['x-action-settings']?.[settingsKey] || [])
    .map((f: any) => f?.dataIndex?.[0])
    .filter(Boolean);

  return {
    title: t(kind === 'export' ? 'Exportable fields' : 'Importable fields'),
    schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          title: t('Fields'),
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          'x-component-props': {
            mode: 'multiple',
            allowClear: true,
            style: { width: '100%' },
            placeholder: t('Select all'),
            options,
          },
        },
      },
    },
    initialValues: { fields: existing },
    components: { FormItem, Select },
    scope: { t },
    onSubmit: (values: any) => {
      const settings = (values?.fields || []).map((dataIndex: string) => ({ dataIndex: [dataIndex] }));
      fieldSchema['x-action-settings'] = fieldSchema['x-action-settings'] || {};
      fieldSchema['x-action-settings'][settingsKey] = settings;
      dn.emit('patch', {
        schema: { 'x-uid': fieldSchema['x-uid'], 'x-action-settings': fieldSchema['x-action-settings'] },
      });
      dn.refresh();
    },
  };
}

export const exportEnhancedActionSettings = new SchemaSettings({
  name: 'actionSettings:exportEnhanced',
  items: [
    {
      name: 'editButton',
      Component: ButtonEditor,
      useComponentProps: () => useSchemaToolbar().buttonEditorProps,
    } as any,
    {
      name: 'linkageRules',
      Component: SchemaSettingsLinkageRules,
      useComponentProps: () => {
        const { name } = useCollection() || ({} as any);
        const { linkageRulesProps } = useSchemaToolbar();
        return { ...linkageRulesProps, collectionName: name };
      },
    } as any,
    {
      name: 'exportableFields',
      type: 'actionModal',
      useComponentProps: () => useConfigurableFieldsProps('export'),
    } as any,
    {
      name: 'divider',
      type: 'divider',
    } as any,
    {
      name: 'delete',
      type: 'remove',
      useComponentProps: () => {
        const { t } = useTranslation();
        return {
          removeParentsIfNoChildren: true,
          breakRemoveOn: (s: any) => s['x-component'] === 'Space' || s['x-component']?.endsWith?.('ActionBar'),
          confirm: { title: t('Delete action') },
        };
      },
    } as any,
  ],
});

export const importEnhancedActionSettings = new SchemaSettings({
  name: 'actionSettings:importEnhanced',
  items: [
    {
      name: 'editButton',
      Component: ButtonEditor,
      useComponentProps: () => useSchemaToolbar().buttonEditorProps,
    } as any,
    {
      name: 'linkageRules',
      Component: SchemaSettingsLinkageRules,
      useComponentProps: () => {
        const { name } = useCollection() || ({} as any);
        const { linkageRulesProps } = useSchemaToolbar();
        return { ...linkageRulesProps, collectionName: name };
      },
    } as any,
    {
      name: 'importableFields',
      type: 'actionModal',
      useComponentProps: () => useConfigurableFieldsProps('import'),
    } as any,
    {
      name: 'divider',
      type: 'divider',
    } as any,
    {
      name: 'delete',
      type: 'remove',
      useComponentProps: () => {
        const { t } = useTranslation();
        return {
          removeParentsIfNoChildren: true,
          breakRemoveOn: (s: any) => s['x-component'] === 'Space' || s['x-component']?.endsWith?.('ActionBar'),
          confirm: { title: t('Delete action') },
        };
      },
    } as any,
  ],
});
