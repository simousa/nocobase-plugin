/**
 * Parses multipart/form-data for the `importEnhanced` action only.
 * After this middleware runs, the file is available on `ctx.file` and text
 * fields on `ctx.request.body`.
 */
export declare function importEnhancedMiddleware(ctx: any, next: any): Promise<any>;
