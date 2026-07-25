/// <reference types="node" />
/// <reference types="node" />
export interface ExportColumn {
    /** field name / dotted path, e.g. "title" or "author.name" */
    dataIndex: string;
    /** column header shown in the sheet */
    title: string;
}
/** Build an xlsx Buffer from column config + record rows. */
export declare function buildXlsxBuffer(columns: ExportColumn[], rows: any[]): Promise<Buffer>;
/**
 * Read rows from an xlsx buffer. The first sheet's first row is treated as the
 * header row. Columns are matched to fields by header title (falling back to
 * dataIndex). Returns one plain object per data row keyed by field name.
 */
export declare function readXlsxRows(buffer: Buffer, columns: ExportColumn[]): Promise<Record<string, any>[]>;
