/** Small helpers shared by the enhanced import/export action handlers. */

/** Resolve the repository for the current action's resource. */
export function getCurrentRepository(ctx: any) {
  if (typeof ctx.getCurrentRepository === 'function') {
    return ctx.getCurrentRepository();
  }
  const db = ctx.db || ctx.app?.db;
  return db.getRepository(ctx.action.resourceName);
}

/** Resolve the primary key attribute name for a collection. */
export function getPrimaryKey(collection: any): string {
  if (!collection) return 'id';
  const ftk = collection.filterTargetKey;
  if (typeof ftk === 'string' && ftk) return ftk;
  if (Array.isArray(ftk) && ftk.length === 1) return ftk[0];
  const modelPk = collection.model?.primaryKeyAttribute;
  if (modelPk) return modelPk;
  return 'id';
}

/** Parse a value that may already be an object or a JSON string. */
export function parseMaybeJson<T = any>(value: any, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value as T;
}
