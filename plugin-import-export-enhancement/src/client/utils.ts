/** Shared client helpers (v1). */

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

/** Build selectable column options from a v1 collection's fields. */
export function buildColumnOptions(fields: any[], compile: (s: any) => any): ColumnOption[] {
  const options: ColumnOption[] = [];
  for (const field of fields || []) {
    const name = field?.name;
    if (!name) continue;
    if (!field?.interface && !field?.primaryKey) continue; // hide system fields, but keep the primary key
    if (EXCLUDED_INTERFACES.has(field.interface)) continue;
    const rawTitle = field?.uiSchema?.title || name;
    options.push({
      dataIndex: name,
      title: String(compile(rawTitle) || name),
      isAssociation: !!field?.target,
    });
  }
  return options;
}

/** Resolve a single primary key name from a collection. */
export function resolvePrimaryKey(collection: any): string {
  const ftk = collection?.filterTargetKey;
  if (typeof ftk === 'string' && ftk) return ftk;
  if (Array.isArray(ftk) && ftk.length) return ftk[0];
  return 'id';
}
