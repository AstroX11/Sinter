// models/findAndCountAll.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { createFindAllMethod } from './findAll.js';

export function createFindAndCountAllMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;
  const findAll = createFindAllMethod(db, modelDefinition);

  /**
   * Finds records and returns count
   * @param options.where The search criteria
   * @param options.order The sort order
   * @param options.limit The maximum number of records
   * @param options.offset The number of records to skip
   * @returns Object containing rows and count
   */
  return function findAndCountAll(
    options: {
      where?: Record<string, any>;
      order?: [string, 'ASC' | 'DESC'][];
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const rows = findAll(options);

    let countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const values: any[] = [];

    if (options.where) {
      const whereClauses = Object.keys(options.where).map((key) => `${key} = ?`);
      countSql += ` WHERE ${whereClauses.join(' AND ')}`;
      values.push(...Object.values(options.where));
    }

    const { count } = db.prepare(countSql).get(...values) as { count: number };

    return {
      rows,
      count,
    };
  };
}
