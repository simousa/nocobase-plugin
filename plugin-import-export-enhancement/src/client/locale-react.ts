import { useTranslation } from 'react-i18next';
// @ts-ignore
import pkg from '../../package.json';

export const NAMESPACE = pkg.name;

/** Translation hook bound to this plugin's namespace (v1 React components). */
export function useT() {
  const { t } = useTranslation([pkg.name, 'client'], { nsMode: 'fallback' } as any);
  return t;
}
