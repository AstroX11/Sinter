// models/findAll.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createFindAllMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;

  /**
   * Finds all records matching the criteria
   * @param options.where The search criteria
   * @param options.order The sort order
   * @param options.limit The maximum number of records
   * @param options.offset The number of records to skip
   * @returns Array of matching records
   */
  return function findAll(
    options: {
      where?: Record<string, any>;
      order?: [string, 'ASC' | 'DESC'][];
      limit?: number;
      offset?: number;
    } = {},
  ) {
    let sql = `SELECT * FROM ${tableName}`;
    const values: any[] = [];

    if (options.where) {
      const whereClauses = Object.keys(options.where).map((key) => `${key} = ?`);
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
      values.push(...Object.values(options.where));
    }

    if (options.order) {
      sql += ` ORDER BY ${options.order.map(([col, dir]) => `${col} ${dir}`).join(', ')}`;
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return db.prepare(sql).all(...values);
  };
}
