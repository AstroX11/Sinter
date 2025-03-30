import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { generateIndexSQL } from './generator.js';

/**
 * Validates if an index exists in the database
 * @param db DatabaseSync instance
 * @param indexName Name of the index to validate
 * @returns boolean indicating if the index exists
 */
function validateIndex(db: DatabaseSync, indexName: string): boolean {
  try {
    const result = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
      .get(indexName);
    return !!result;
  } catch (error) {
    console.error(
      `Failed to validate index ${indexName}:`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

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
      // Extract index name from SQL (assumes format: CREATE INDEX idx_name ON...)
      const indexName = sql.match(/CREATE\s+INDEX\s+([^\s]+)/i)?.[1];
      if (indexName && !validateIndex(db, indexName)) {
        console.warn(`Index ${indexName} was not created successfully`);
      }
    } catch (error) {
      console.error(
        `Failed to create index: ${sql}`,
        error instanceof Error ? error.message : String(error),
      );
      // Continue with other indexes even if one fails
    }
  }
}
