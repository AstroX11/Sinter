import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { generateIndexSQL } from './index-generator.js';

/**
 * Executes index creation for a model definition
 * @param db DatabaseSync instance
 * @param def Model definition containing indexes
 */
export function createIndexes(db: DatabaseSync, def: ModelDefinition): void {
  if (!db) throw new Error('Database instance is required');
  if (!def?.tableName) throw new Error('Model definition requires a tableName');

  const indexSQLs = generateIndexSQL(def);

  for (const sql of indexSQLs) {
    try {
      db.exec(sql);
    } catch (error) {
      console.error(
        `Failed to create index: ${sql}`,
        error instanceof Error ? error.message : String(error),
      );
      // Continue with other indexes even if one fails
    }
  }
}
