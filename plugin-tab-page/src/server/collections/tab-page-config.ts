import { defineCollection } from '@nocobase/database';
import { SETTINGS_COLLECTION } from '../../constants';

/**
 * Single-row table holding the *global* tab-page settings edited on the plugin
 * settings page. Personal overrides live in the browser's localStorage, never
 * here.
 *
 * `dataCategory: 'system'` keeps it out of the regular data-source pickers.
 */
export default defineCollection({
  dumpRules: 'required',
  migrationRules: ['overwrite', 'skip'],
  dataCategory: 'system',
  name: SETTINGS_COLLECTION,
  title: 'Tab page global settings',
  autoGenId: true,
  timestamps: true,
  fields: [
    {
      type: 'json',
      name: 'options',
      defaultValue: {},
    },
  ],
});
