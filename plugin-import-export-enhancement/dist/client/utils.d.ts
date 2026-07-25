/** Shared client helpers (v1). */
export interface ColumnOption {
    dataIndex: string;
    title: string;
    isAssociation?: boolean;
}
/** Download a Blob as a file via a temporary anchor element. */
export declare function saveBlob(data: any, filename: string): void;
/** Build selectable column options from a v1 collection's fields. */
export declare function buildColumnOptions(fields: any[], compile: (s: any) => any): ColumnOption[];
/** Resolve a single primary key name from a collection. */
export declare function resolvePrimaryKey(collection: any): string;
