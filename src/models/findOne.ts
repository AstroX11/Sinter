// models/findOne.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { safeGet, convertValueForSQLite } from '../utils/queryHelpers.js';

export function createFindOneMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;

  return function findOne(
    options: {
      where?: Record<string, any>;
      order?: [string, 'ASC' | 'DESC'][];
    } = {},
  ) {
    let sql = `SELECT * FROM ${tableName}`;
    const values: any[] = [];

    if (options?.where) {
      const whereClauses = Object.keys(options.where)
        .filter((key) => options.where?.[key] !== undefined)
        .map((key) => {
          const value = convertValueForSQLite(safeGet(options.where, key));
          if (value === null) {
            return `${key} IS NULL`;
          }
          values.push(value);
          return `${key} = ?`;
        });

      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
    }

    if (options?.order) {
      const orderClauses = options.order
        .filter(([col]) => col)
        .map(([col, dir]) => `${col} ${dir === 'DESC' ? 'DESC' : 'ASC'}`);

      if (orderClauses.length > 0) {
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
      }
    }

    sql += ' LIMIT 1';

    try {
      const stmt = db.prepare(sql);
      return values.length > 0 ? stmt.get(...values) : stmt.get();
    } catch (error) {
      console.error(`Error executing findOne query: ${sql}`, values);
      throw error;
    }
  };
}
