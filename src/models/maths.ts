// models/math.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createMathMethods(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;

  return {
    /**
     * Counts records matching criteria
     */
    count(options: { where?: Record<string, any> } = {}) {
      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const values: any[] = [];

      if (options.where) {
        const whereClauses = Object.keys(options.where).map((key) => `${key} = ?`);
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
        values.push(...Object.values(options.where));
      }

      return (db.prepare(sql).get(...values) as { count: number }).count;
    },

    /**
     * Gets maximum value of a column
     */
    max(column: string, options: { where?: Record<string, any> } = {}) {
      let sql = `SELECT MAX(${column}) as max FROM ${tableName}`;
      const values: any[] = [];

      if (options.where) {
        const whereClauses = Object.keys(options.where).map((key) => `${key} = ?`);
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
        values.push(...Object.values(options.where));
      }

      return (db.prepare(sql).get(...values) as { max: number }).max;
    },

    /**
     * Gets minimum value of a column
     */
    min(column: string, options: { where?: Record<string, any> } = {}) {
      let sql = `SELECT MIN(${column}) as min FROM ${tableName}`;
      const values: any[] = [];

      if (options.where) {
        const whereClauses = Object.keys(options.where).map((key) => `${key} = ?`);
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
        values.push(...Object.values(options.where));
      }

      return (db.prepare(sql).get(...values) as { min: number }).min;
    },

    /**
     * Gets sum of a column
     */
    sum(column: string, options: { where?: Record<string, any> } = {}) {
      let sql = `SELECT SUM(${column}) as sum FROM ${tableName}`;
      const values: any[] = [];

      if (options.where) {
        const whereClauses = Object.keys(options.where).map((key) => `${key} = ?`);
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
        values.push(...Object.values(options.where));
      }

      return (db.prepare(sql).get(...values) as { sum: number | null }).sum || 0;
    },
  };
}
