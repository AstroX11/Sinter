// models/findAndCountAll.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { buildWhereClause } from '../utils/whereBuilder.js';
import { createFindAllMethod } from './findAll.js';

/**
 * Creates a findAndCountAll method for a Sequelize model (SQLite implementation)
 *
 * @param db - SQLite database sync instance
 * @param modelDefinition - Model definition object
 * @returns Function that finds all instances matching the query and returns them with the total count
 */
export function createFindAndCountAllMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;
  const findAll = createFindAllMethod(db, modelDefinition);

  return function findAndCountAll(
    options: {
      where?: Record<string, any>;
      order?: [string, 'ASC' | 'DESC'][];
      limit?: number;
      offset?: number;
    } = {},
  ): { rows: any[]; count: number } {
    // Get the paginated/filtered/sorted rows
    const rows = findAll(options);

    // Build the count query
    let countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const values: any[] = [];

    // Add WHERE clause if provided
    if (options.where) {
      const { clause, values: whereValues } = buildWhereClause(options.where);
      countSql += ` ${clause}`;
      values.push(...whereValues);
    }

    // Execute count query
    const result = db.prepare(countSql).get(...values) as { count: number };
    const { count } = result;

    return {
      rows,
      count,
    };
  };
}
