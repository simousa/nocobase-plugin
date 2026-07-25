import { readXlsxRows, ExportColumn } from '../utils/xlsx';
import { getCurrentRepository, getPrimaryKey, parseMaybeJson } from '../utils/repository';

export type ImportMode = 'append' | 'update' | 'overwrite';

/** Coerce a cell value into a value acceptable for the given field type. */
function coerceValue(fieldType: string | undefined, value: any): any {
  if (value === null || value === undefined || value === '') return null;
  switch (fieldType) {
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const s = String(value).trim().toLowerCase();
      return ['true', '1', 'yes', 'y', '是'].includes(s);
    }
    case 'integer':
    case 'bigInt':
    case 'float':
    case 'double':
    case 'decimal':
    case 'real':
    case 'sort': {
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case 'date':
    case 'datetime':
    case 'datetimeTz':
    case 'datetimeNoTz':
    case 'dateOnly':
    case 'unixTimestamp': {
      if (value instanceof Date) return value;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    case 'json':
    case 'jsonb':
    case 'array':
    case 'set': {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      return value;
    }
    default:
      return value;
  }
}

/** Build a sanitized values object from a raw xlsx row for the given collection. */
function buildRowValues(collection: any, row: Record<string, any>): Record<string, any> {
  const values: Record<string, any> = {};
  for (const [key, raw] of Object.entries(row)) {
    if (key.includes('.')) continue; // association paths are not importable
    const field = collection?.getField?.(key);
    if (collection && !field) continue; // skip unknown fields
    values[key] = coerceValue(field?.type, raw);
  }
  return values;
}

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
export async function importEnhanced(ctx: any, next: any) {
  const repository = getCurrentRepository(ctx);
  const collection = repository.collection;
  const file = ctx.file || ctx.request?.file;
  if (!file?.buffer) {
    return ctx.throw(400, 'Import file is required (multipart field "file")');
  }

  const body = ctx.request.body || {};
  const columns: ExportColumn[] = parseMaybeJson(body.columns, []);
  if (!Array.isArray(columns) || !columns.length) {
    return ctx.throw(400, 'columns is required');
  }
  const mode: ImportMode = ['append', 'update', 'overwrite'].includes(body.mode) ? body.mode : 'append';
  const filter = parseMaybeJson(body.filter, undefined);
  const pk = getPrimaryKey(collection);

  // Only plain (non-association) columns are importable
  const importableColumns = columns.filter((c) => typeof c.dataIndex === 'string' && !c.dataIndex.includes('.'));
  if (!importableColumns.length) {
    return ctx.throw(400, 'No importable (non-association) columns selected');
  }

  const rows = await readXlsxRows(file.buffer, importableColumns);

  const db = repository.database || ctx.db || ctx.app?.db;
  const transaction = await db.sequelize.transaction();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    if (mode === 'overwrite') {
      if (filter && Object.keys(filter).length) {
        await repository.destroy({ filter, transaction });
      } else {
        await repository.destroy({ truncate: true, transaction });
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const values = buildRowValues(collection, rows[i]);
      try {
        if (mode === 'update') {
          const pkValue = values[pk] ?? rows[i][pk];
          delete values[pk];
          if (pkValue === null || pkValue === undefined || pkValue === '' || !Object.keys(values).length) {
            skipped++;
            continue;
          }
          const exists = await repository.findOne({ filterByTk: pkValue, transaction });
          if (!exists) {
            skipped++;
            continue;
          }
          await repository.update({ filterByTk: pkValue, values, transaction });
          updated++;
        } else {
          if (mode === 'append') {
            delete values[pk];
          }
          if (!Object.keys(values).length) {
            skipped++;
            continue;
          }
          await repository.create({ values, transaction });
          created++;
        }
      } catch (err: any) {
        // +2: 1 header row + 1-based row numbers
        throw new Error(`Row ${i + 2}: ${err?.message || err}`);
      }
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  ctx.body = { mode, total: rows.length, created, updated, skipped };
  await next();
}
