// models/bulkCreate.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createBulkCreateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  return function bulkCreate(records: Array<Record<string, any>>) {
    if (!records.length) return [];

    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    db.exec('BEGIN TRANSACTION');
    try {
      const insertedIds = [];
      const stmt = db.prepare(sql);

      for (const record of records) {
        const result = stmt.run(...columns.map(col => record[col]));
        insertedIds.push(result.lastInsertRowid);
      }

      db.exec('COMMIT');
      return insertedIds;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
}