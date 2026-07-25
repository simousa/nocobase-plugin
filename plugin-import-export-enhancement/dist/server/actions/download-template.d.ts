/**
 * `downloadImportTemplate` resource action.
 *
 * Params:
 * - columns: ExportColumn[] (required) — the columns the user plans to import
 *
 * Responds with an xlsx file containing only the header row.
 */
export declare function downloadImportTemplate(ctx: any, next: any): Promise<any>;
