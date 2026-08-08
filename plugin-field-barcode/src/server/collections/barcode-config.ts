import { defineCollection } from '@nocobase/database';
import { SETTINGS_COLLECTION } from '../../constants';

/**
 * Single-row table holding the *global* barcode defaults edited on the plugin
 * settings page. Field-level settings live in the UI schema (flow stepParams),
 * not here.
 *
 * `dataCategory: 'system'` keeps it out of the regular data-source pickers.
 */
export default defineCollection({
  dumpRules: 'required',
  migrationRules: ['overwrite', 'skip'],
  dataCategory: 'system',
  name: SETTINGS_COLLECTION,
  title: 'Barcode global defaults',
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
