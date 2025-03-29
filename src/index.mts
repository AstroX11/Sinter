(await import('./version.js')).ensureNode23();
export * from './core.mjs';

import { Database } from './core.mjs';

export default Database;
export { Database };
