/** Small helpers shared by the enhanced import/export action handlers. */
/** Resolve the repository for the current action's resource. */
export declare function getCurrentRepository(ctx: any): any;
/** Resolve the primary key attribute name for a collection. */
export declare function getPrimaryKey(collection: any): string;
/** Parse a value that may already be an object or a JSON string. */
export declare function parseMaybeJson<T = any>(value: any, fallback: T): T;
