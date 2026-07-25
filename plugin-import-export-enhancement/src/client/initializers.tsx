import React from 'react';
import { SchemaInitializerItem, useSchemaInitializer, useSchemaInitializerItem } from '@nocobase/client';

function makeActionSchema(component: string, action: string, settings: string) {
  return {
    type: 'void',
    'x-action': action,
    'x-component': component,
    'x-toolbar': 'ActionSchemaToolbar',
    'x-settings': settings,
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
        insert(makeActionSchema('ExportEnhancedAction', 'exportEnhanced', 'actionSettings:exportEnhanced'));
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
        insert(makeActionSchema('ImportEnhancedAction', 'importEnhanced', 'actionSettings:importEnhanced'));
      }}
    />
  );
};
