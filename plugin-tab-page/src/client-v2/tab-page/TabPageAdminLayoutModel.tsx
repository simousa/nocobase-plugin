/**
 * v2 lane instantiation of the tab-page `AdminLayoutModel` subclass.
 *
 * The v2 shell registers the v2 `AdminLayoutModel` (from `@nocobase/client-v2`)
 * under the layout model name, so we pass that exact class to the shared
 * factory. The v1 lane builds its own subclass from the runtime-registered
 * `AdminLayoutModelV1` (see `src/client/plugin.tsx`).
 */
import { AdminLayoutModel } from '@nocobase/client-v2';
import { createTabPageAdminLayoutModel } from './createTabPageAdminLayoutModel';

export const TabPageAdminLayoutModel = createTabPageAdminLayoutModel(AdminLayoutModel);

export default TabPageAdminLayoutModel;
