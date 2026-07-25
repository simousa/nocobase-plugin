/**
 * `exportEnhanced` resource action.
 *
 * Params (POST body `values` or query params):
 * - columns: ExportColumn[]  (required) — fields to export
 * - filter:  object          (optional) — export scope; omit for whole collection
 * - sort:    string[]        (optional)
 *
 * Responds with an xlsx binary attachment.
 */
export declare function exportEnhanced(ctx: any, next: any): Promise<any>;
