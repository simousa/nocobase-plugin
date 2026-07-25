/** Shared client helpers (v2). */
export interface ColumnOption {
    dataIndex: string;
    title: string;
    isAssociation?: boolean;
}
/** Download a Blob as a file via a temporary anchor element. */
export declare function saveBlob(data: any, filename: string): void;
/**
 * Build selectable column options from a v2 collection's fields.
 * `t` compiles deferred uiSchema titles into display strings.
 */
export declare function buildColumnOptions(fields: any[], t: (s: string) => string): ColumnOption[];
/** Resolve a single primary key name from a collection (v1 or v2 shape). */
export declare function resolvePrimaryKey(collection: any): string;
