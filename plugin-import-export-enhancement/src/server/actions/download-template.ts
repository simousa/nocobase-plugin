import { buildXlsxBuffer, ExportColumn } from '../utils/xlsx';
import { parseMaybeJson } from '../utils/repository';

/**
 * `downloadImportTemplate` resource action.
 *
 * Params:
 * - columns: ExportColumn[] (required) — the columns the user plans to import
 *
 * Responds with an xlsx file containing only the header row.
 */
export async function downloadImportTemplate(ctx: any, next: any) {
  const params = ctx.action.params || {};
  const values = params.values || {};

  const columns: ExportColumn[] = parseMaybeJson(values.columns ?? params.columns, []);
  if (!Array.isArray(columns) || !columns.length) {
    return ctx.throw(400, 'columns is required');
  }

  const buffer = await buildXlsxBuffer(columns, []);

  ctx.withoutDataWrapping = true;
  ctx.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename=${encodeURIComponent(ctx.action.resourceName)}-template.xlsx`,
  });
  ctx.body = buffer;

  await next();
}
