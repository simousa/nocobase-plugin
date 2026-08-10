import { tExpr as _tExpr, useFlowEngine } from '@nocobase/flow-engine';
// @ts-ignore
import pkg from './../../package.json';

/** Namespaces used by this plugin — the package name plus the shared `client`. */
const NS = [pkg.name, 'client'];

/** `t()` bound to the plugin namespace, for use inside FlowEngine components. */
export function useT() {
  const engine = useFlowEngine();
  return (str: string, options?: any) => engine.context.t(str, { ns: NS, ...options }) as unknown as string;
}

/** Build a `{{t('...')}}`-style expression usable in Formily schemas. */
export function tExpr(key: string) {
  return _tExpr(key, { ns: NS });
}

export { NS as TAB_PAGE_I18N_NS };
