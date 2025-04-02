import type { DatabaseSync, SupportedValueType } from 'node:sqlite';
import type { BulkCreateOptions, ModelDefinition } from '../Types.mjs';

export function createBulkCreateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  if (!tableName || !attributes || typeof attributes !== 'object') {
    throw new Error('Invalid model definition: tableName and attributes are required');
  }

  const primaryKey =
    Object.entries(attributes).find(([_, attr]) => attr.primaryKey === true)?.[0] ?? 'id';

  if (!attributes[primaryKey]) {
    throw new Error(`Primary key '${primaryKey}' not found in model attributes`);
  }

  return function bulkCreate(
    records: Array<Record<string, SupportedValueType>>,
    options: BulkCreateOptions = {},
  ): number[] | Array<Record<string, SupportedValueType>> {
    if (!Array.isArray(records)) {
      throw new Error('Records must be an array');
    }

    if (records.length === 0) {
      return [];
    }

    if (!records.every((rec) => rec && typeof rec === 'object')) {
      throw new Error('All records must be non-null objects');
    }

    const {
      transaction = true,
      returnRecords = false,
      ignoreDuplicates = false,
      updateOnConflict = false,
      batchSize = 500,
    } = options;

    if (typeof batchSize !== 'number' || batchSize < 1) {
      throw new Error('batchSize must be a positive number');
    }

    if (ignoreDuplicates && updateOnConflict) {
      throw new Error('ignoreDuplicates and updateOnConflict cannot be used together');
    }

    const columns = Object.keys(records[0]);

    if (columns.length === 0) {
      throw new Error('No columns found in records');
    }

    const invalidRecord = records.find(
      (rec) => !columns.every((col) => Object.prototype.hasOwnProperty.call(rec, col)),
    );
    if (invalidRecord) {
      throw new Error('All records must have the same column structure');
    }

    const invalidColumns = columns.filter((col) => !attributes[col]);
    if (invalidColumns.length > 0) {
      throw new Error(`Invalid columns found: ${invalidColumns.join(', ')}`);
    }

    let conflictClause = '';
    if (ignoreDuplicates) {
      conflictClause = 'OR IGNORE';
    } else if (updateOnConflict) {
      const updateColumns = columns
        .filter((col) => col !== primaryKey)
        .map((col) => `${col} = excluded.${col}`)
        .join(', ');

      if (!updateColumns) {
        throw new Error('No columns available for update on conflict');
      }
      conflictClause = `ON CONFLICT(${primaryKey}) DO UPDATE SET ${updateColumns}`;
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT ${conflictClause} INTO ${tableName} (${columns.join(
      ', ',
    )}) VALUES (${placeholders})`;

    let stmt;
    try {
      stmt = db.prepare(sql);
    } catch (error) {
      throw new Error(
        `Failed to prepare SQL statement: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const insertedIds: number[] = [];
    const insertedRecords: Array<Record<string, SupportedValueType>> = [];

    const executeBatch = () => {
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        for (const record of batch) {
          try {
            const values: SupportedValueType[] = columns.map((col) => record[col] ?? null);
            const result = stmt.run(...values);

            if (typeof result.lastInsertRowid !== 'number') {
              throw new Error('Invalid lastInsertRowid returned from database');
            }

            const id = result.lastInsertRowid;
            insertedIds.push(id);

            if (returnRecords) {
              insertedRecords.push({ ...record, [primaryKey]: id });
            }
          } catch (error) {
            throw new Error(
              `Failed to insert record: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    };

    if (transaction) {
      try {
        db.exec('BEGIN TRANSACTION');
        executeBatch();
        db.exec('COMMIT');
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch (rollbackError) {
          throw new Error(
            `Transaction failed: ${
              error instanceof Error ? error.message : String(error)
            }, Rollback failed: ${
              rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
            }`,
          );
        }
        throw new Error(
          `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      executeBatch();
    }

    return returnRecords ? insertedRecords : insertedIds;
  };
}
