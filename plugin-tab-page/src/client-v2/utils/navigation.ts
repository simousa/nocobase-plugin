/**
 * Local mirror of NocoBase's `toRouterNavigationPath` / `normalizeRootRelativePath`
 * (from @nocobase/client-v2). We keep a local copy because the runtime helper is
 * not present in the published TypeScript declarations, and re-implementing it here
 * avoids a build-time type error while keeping navigation 100% consistent with the
 * canonical NocoBase admin-menu navigation.
 */

function normalizeRootRelativePath(pathname: string): string {
  const normalized = `/${String(pathname || '/').trim() || '/'}`.replace(/\/{2,}/g, '/');
  if (normalized !== '/' && normalized.endsWith('/')) {
    return normalized.replace(/\/+$/g, '');
  }
  return normalized;
}

/**
 * Convert a FULL pathname (e.g. /admin/pm/list) into the path that React Router
 * expects — relative to the app basename (e.g. /pm/list for basename /admin).
 * Mirrors `router.navigate(toRouterNavigationPath(runtimePath, basename))` used by
 * NocoBase's own menu navigation, which is what fixes the "route appended" bug.
 */
export function toRouterNavigationPath(pathname: string, basename?: string): string {
  const normalizedPathname = normalizeRootRelativePath(pathname);
  const normalizedBasename =
    basename && basename !== '/' ? normalizeRootRelativePath(basename) : '';

  if (!normalizedBasename) {
    return normalizedPathname;
  }

  if (normalizedPathname === normalizedBasename) {
    return '/';
  }

  if (normalizedPathname.startsWith(`${normalizedBasename}/`)) {
    return normalizeRootRelativePath(normalizedPathname.slice(normalizedBasename.length));
  }

  return normalizedPathname;
}
