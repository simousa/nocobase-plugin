import { tExpr as _tExpr, useFlowEngine } from '@nocobase/flow-engine';
// @ts-ignore
import pkg from '../../package.json';

export const NAMESPACE = pkg.name;

export function useT() {
  const engine = useFlowEngine();
  return (str: string, options?: any) => engine.context.t(str, { ns: [pkg.name, 'client'], ...options });
}

export function tExpr(key: string) {
  return _tExpr(key, { ns: [pkg.name, 'client'] });
}
