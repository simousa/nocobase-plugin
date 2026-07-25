/**
 * XLSX helpers built on top of SheetJS (`xlsx`).
 *
 * SheetJS is dependency-free, which avoids runtime issues seen with
 * exceljs' transitive dependencies (bluebird) in the NocoBase server
 * environment.
 *
 * These helpers convert between NocoBase record objects and worksheet rows
 * using a simple column config `{ dataIndex, title }`, where `dataIndex` is
 * the (possibly dotted) field path and `title` is the human-facing column
 * header used in the sheet.
 */
import * as XLSX from 'xlsx';

export interface ExportColumn {
  /** field name / dotted path, e.g. "title" or "author.name" */
  dataIndex: string;
  /** column header shown in the sheet */
  title: string;
}

/** Read a nested value by dotted path from a plain object. */
function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  if (path.indexOf('.') === -1) return obj[path];
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function scalarify(v: any): any {
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('id' in v) return v.id;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return v;
}

/** Convert any record value into a value safe to write into a worksheet cell. */
function toCellValue(value: any): any {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value
        .map((v) => scalarify(v))
        .filter((v) => v !== '' && v != null)
        .join(', ');
    }
    // Relation object -> prefer id
    if ('id' in value) return value.id;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

/** Build an xlsx Buffer from column config + record rows. */
export async function buildXlsxBuffer(columns: ExportColumn[], rows: any[]): Promise<Buffer> {
  const aoa: any[][] = [columns.map((c) => c.title || c.dataIndex)];
  for (const row of rows || []) {
    aoa.push(columns.map((c) => toCellValue(getByPath(row, c.dataIndex))));
  }
  const worksheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  worksheet['!cols'] = columns.map(() => ({ wch: 20 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Read rows from an xlsx buffer. The first sheet's first row is treated as the
 * header row. Columns are matched to fields by header title (falling back to
 * dataIndex). Returns one plain object per data row keyed by field name.
 */
export async function readXlsxRows(buffer: Buffer, columns: ExportColumn[]): Promise<Record<string, any>[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];

  const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true }) as any[][];
  if (!aoa.length) return [];

  const headers = (aoa[0] || []).map((h) => (h == null ? '' : String(h).trim()));
  const titleToCol: Record<string, number> = {};
  headers.forEach((h, idx) => {
    if (h && !(h in titleToCol)) titleToCol[h] = idx;
  });

  const colMap = columns
    .map((c) => ({
      field: c.dataIndex,
      col: titleToCol[c.title] ?? titleToCol[c.dataIndex],
    }))
    .filter((m) => m.col !== undefined);

  const rows: Record<string, any>[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const rowArr = aoa[r] || [];
    const obj: Record<string, any> = {};
    let hasValue = false;
    for (const { field, col } of colMap) {
      const v = rowArr[col as number] ?? null;
      obj[field] = v;
      if (v !== null && v !== '' && v !== undefined) hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }
  return rows;
}
