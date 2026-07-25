export type ImportMode = 'append' | 'update' | 'overwrite';
/**
 * `importEnhanced` resource action (multipart/form-data).
 *
 * Form fields:
 * - file:    xlsx file (required, single file, field name "file")
 * - columns: JSON string of ExportColumn[] (required)
 * - mode:    'append' | 'update' | 'overwrite' (default 'append')
 * - filter:  JSON string — overwrite scope (only rows matching filter are
 *            deleted before re-import); empty = whole collection
 *
 * Modes:
 * - append:    ignore the primary key column, create every row
 * - update:    match rows by primary key, update ONLY the imported columns
 * - overwrite: delete rows in scope, then create rows from the sheet
 */
export declare function importEnhanced(ctx: any, next: any): Promise<any>;
