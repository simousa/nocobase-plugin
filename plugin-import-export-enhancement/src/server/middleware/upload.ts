import { koaMulter } from '@nocobase/utils';

const LIMIT_FILE_SIZE_MB = 200;

const upload = koaMulter({
  storage: koaMulter.memoryStorage(),
  limits: { fileSize: LIMIT_FILE_SIZE_MB * 1024 * 1024 },
}).single('file');

/**
 * Parses multipart/form-data for the `importEnhanced` action only.
 * After this middleware runs, the file is available on `ctx.file` and text
 * fields on `ctx.request.body`.
 */
export async function importEnhancedMiddleware(ctx: any, next: any) {
  if (ctx.action?.actionName !== 'importEnhanced') {
    return next();
  }
  if (!/multipart\/form-data/i.test(ctx.get('Content-Type') || '')) {
    return next();
  }
  await upload(ctx, async () => {});
  await next();
}
