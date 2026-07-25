import { SchemaSettings } from '@nocobase/client';

/** Minimal schema settings so the buttons can be removed from the toolbar. */
export const exportEnhancedActionSettings = new SchemaSettings({
  name: 'actionSettings:exportEnhanced',
  items: [
    {
      name: 'remove',
      type: 'remove',
      componentProps: {
        removeParentsIfNoChildren: true,
        breakRemoveOn: (s: any) => s['x-component'] === 'Space' || s['x-component']?.endsWith?.('ActionBar'),
      },
    },
  ],
});

export const importEnhancedActionSettings = new SchemaSettings({
  name: 'actionSettings:importEnhanced',
  items: [
    {
      name: 'remove',
      type: 'remove',
      componentProps: {
        removeParentsIfNoChildren: true,
        breakRemoveOn: (s: any) => s['x-component'] === 'Space' || s['x-component']?.endsWith?.('ActionBar'),
      },
    },
  ],
});
