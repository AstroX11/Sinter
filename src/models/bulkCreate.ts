import type { DatabaseSync } from 'node:sqlite';
import type { BulkCreateOptions, ModelDefinition } from '../Types.mjs';

export function createBulkCreateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  const primaryKey =
    Object.entries(attributes).find(([_, attr]) => attr.primaryKey === true)?.[0] || 'id';

  return function bulkCreate(records: Array<Record<string, any>>, options: BulkCreateOptions = {}) {
    if (!records.length) return [];

    const {
      transaction = true,
      returnRecords = false,
      ignoreDuplicates = false,
      updateOnConflict = false,
      batchSize = 500,
    } = options;

    const columns = Object.keys(records[0]);

    let conflictClause = '';
    if (ignoreDuplicates) {
      conflictClause = 'OR IGNORE';
    } else if (updateOnConflict) {
      const updateColumns = columns
        .filter((col) => col !== primaryKey)
        .map((col) => `${col} = excluded.${col}`)
        .join(', ');

      if (updateColumns) {
        conflictClause = `ON CONFLICT(${primaryKey}) DO UPDATE SET ${updateColumns}`;
      }
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT ${conflictClause} INTO ${tableName} (${columns.join(
      ', ',
    )}) VALUES (${placeholders})`;

    if (transaction) {
      db.exec('BEGIN TRANSACTION');
    }

    try {
      const insertedIds = [];
      const insertedRecords = [];
      const stmt = db.prepare(sql);

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        for (const record of batch) {
          const values = columns.map((col) => record[col]);
          const result = stmt.run(...values);
          const id = result.lastInsertRowid;

          insertedIds.push(id);

          if (returnRecords) {
            insertedRecords.push({ ...record, [primaryKey]: id });
          }
        }
      }

      if (transaction) {
        db.exec('COMMIT');
      }

      return returnRecords ? insertedRecords : insertedIds;
    } catch (error) {
      if (transaction) {
        db.exec('ROLLBACK');
      }
      throw error;
    }
  };
}
