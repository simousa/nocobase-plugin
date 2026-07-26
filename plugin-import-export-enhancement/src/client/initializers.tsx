import React from 'react';
import { SchemaInitializerItem, useSchemaInitializer, useSchemaInitializerItem } from '@nocobase/client';
// @ts-ignore
import pkg from '../../package.json';

function makeActionSchema(component: string, action: string, settings: string, title: string, icon: string) {
  return {
    type: 'void',
    // Editable via the "Edit button" settings item (ButtonEditor writes schema.title).
    title: `{{t("${title}", { ns: "${pkg.name}" })}}`,
    'x-action': action,
    'x-component': component,
    'x-toolbar': 'ActionSchemaToolbar',
    'x-settings': settings,
    'x-component-props': { icon },
    'x-align': 'right',
  };
}

export const ExportEnhancedActionInitializer: React.FC = () => {
  const itemConfig = useSchemaInitializerItem();
  const { insert } = useSchemaInitializer();
  return (
    <SchemaInitializerItem
      title={itemConfig.title}
      onClick={() => {
        insert(
          makeActionSchema(
            'ExportEnhancedAction',
            'exportEnhanced',
            'actionSettings:exportEnhanced',
            'Export (Enhanced)',
            'CloudDownloadOutlined',
          ),
        );
      }}
    />
  );
};

export const ImportEnhancedActionInitializer: React.FC = () => {
  const itemConfig = useSchemaInitializerItem();
  const { insert } = useSchemaInitializer();
  return (
    <SchemaInitializerItem
      title={itemConfig.title}
      onClick={() => {
        insert(
          makeActionSchema(
            'ImportEnhancedAction',
            'importEnhanced',
            'actionSettings:importEnhanced',
            'Import (Enhanced)',
            'CloudUploadOutlined',
          ),
        );
      }}
    />
  );
};
