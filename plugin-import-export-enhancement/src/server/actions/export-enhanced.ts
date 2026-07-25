import { buildXlsxBuffer, ExportColumn } from '../utils/xlsx';
import { getCurrentRepository, parseMaybeJson } from '../utils/repository';

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
export async function exportEnhanced(ctx: any, next: any) {
  const repository = getCurrentRepository(ctx);
  const params = ctx.action.params || {};
  const values = params.values || {};

  const columns: ExportColumn[] = parseMaybeJson(values.columns ?? params.columns, []);
  if (!Array.isArray(columns) || !columns.length) {
    return ctx.throw(400, 'columns is required');
  }

  const filter = parseMaybeJson(values.filter ?? params.filter, undefined);
  const sort = values.sort ?? params.sort;

  // Derive appends from dotted paths, e.g. "author.name" -> append "author"
  const appends = Array.from(
    new Set(
      columns
        .filter((c) => typeof c.dataIndex === 'string' && c.dataIndex.includes('.'))
        .map((c) => c.dataIndex.split('.')[0]),
    ),
  );

  const records = await repository.find({
    filter: filter && Object.keys(filter).length ? filter : undefined,
    sort,
    appends: appends.length ? appends : undefined,
  });

  const rows = (records || []).map((r: any) => (typeof r.toJSON === 'function' ? r.toJSON() : r));
  const buffer = await buildXlsxBuffer(columns, rows);

  ctx.withoutDataWrapping = true;
  ctx.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename=${encodeURIComponent(ctx.action.resourceName)}.xlsx`,
  });
  ctx.body = buffer;

  await next();
}
