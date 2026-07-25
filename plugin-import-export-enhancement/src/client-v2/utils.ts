/** Shared client helpers (v2). */

export interface ColumnOption {
  dataIndex: string;
  title: string;
  isAssociation?: boolean;
}

/** Download a Blob as a file via a temporary anchor element. */
export function saveBlob(data: any, filename: string) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EXCLUDED_INTERFACES = new Set(['password']);

/**
 * Build selectable column options from a v2 collection's fields.
 * `t` compiles deferred uiSchema titles into display strings.
 */
export function buildColumnOptions(fields: any[], t: (s: string) => string): ColumnOption[] {
  const options: ColumnOption[] = [];
  for (const field of fields || []) {
    const name = field?.name;
    if (!name) continue;
    if (EXCLUDED_INTERFACES.has(field?.interface)) continue;
    const rawTitle = field?.uiSchema?.title || field?.title || name;
    const isAssociation = !!field?.target;
    options.push({
      dataIndex: name,
      title: typeof rawTitle === 'string' ? t(rawTitle) || name : name,
      isAssociation,
    });
  }
  return options;
}

/** Resolve a single primary key name from a collection (v1 or v2 shape). */
export function resolvePrimaryKey(collection: any): string {
  const ftk = collection?.filterTargetKey;
  if (typeof ftk === 'string' && ftk) return ftk;
  if (Array.isArray(ftk) && ftk.length) return ftk[0];
  return 'id';
}
