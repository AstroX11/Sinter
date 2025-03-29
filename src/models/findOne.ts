// models/findOne.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createFindOneMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;

  /**
   * Finds a single record matching the criteria
   * @param options.where The search criteria
   * @param options.order The sort order
   * @returns The first matching record or undefined
   */
  return function findOne(options: {
    where?: Record<string, any>;
    order?: [string, 'ASC' | 'DESC'][];
  } = {}) {
    let sql = `SELECT * FROM ${tableName}`;
    const values: any[] = [];

    if (options.where) {
      const whereClauses = Object.keys(options.where)
        .map(key => `${key} = ?`);
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
      values.push(...Object.values(options.where));
    }

    if (options.order) {
      sql += ` ORDER BY ${options.order.map(([col, dir]) => `${col} ${dir}`).join(', ')}`;
    }

    sql += ' LIMIT 1';
    return db.prepare(sql).get(...values);
  };
}