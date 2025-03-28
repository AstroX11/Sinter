(await import('./version.js')).ensureNode23();
import Database from './core.js';
export * from './core.js';
type sqlite = typeof Database;
export default Database as sqlite;
export { Database as sqlite };
