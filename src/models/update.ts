import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { convertValueForSQLite } from '../utils/queryHelpers.js';

export function createUpdateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, options: opt } = modelDefinition;

  return async function update(
    values: Record<string, any>,
    options: {
      where: Record<string, any>;
      returning?: string[] | boolean;
      limit?: number;
      transaction?: DatabaseSync;
      ignoreChanges?: boolean;
      upsert?: {
        onConflict: string | string[];
        conflictValues: Record<string, any>;
      };
    } = { where: {} },
  ): Promise<{ changes: number; returning?: any[] }> {
    if (!options?.where && !options?.upsert) {
      throw new Error('Where clause or upsert configuration is required for update');
    }

    // Handle automatic timestamp updates if enabled
    const updateValues = { ...values };
    if (opt?.timestamps) {
      updateValues.updatedAt = new Date();
    }

    // SET clause
    const setClauses = Object.keys(updateValues)
      .filter((key) => updateValues[key] !== undefined)
      .map((key) => `${key} = ?`);

    if (setClauses.length === 0) {
      throw new Error('No valid values provided for update');
    }

    // WHERE clause with support for operators
    const whereConditions: string[] = [];
    const whereValues: any[] = [];

    for (const [key, condition] of Object.entries(options.where || {})) {
      if (condition === undefined) continue;

      if (typeof condition === 'object' && condition !== null) {
        // Handle operator syntax (e.g., { gt: 5 })
        for (const [op, value] of Object.entries(condition)) {
          const sqlValue = convertValueForSQLite(value);

          switch (op) {
            case 'eq':
              whereConditions.push(`${key} = ?`);
              whereValues.push(sqlValue);
              break;
            case 'ne':
              whereConditions.push(`${key} != ?`);
              whereValues.push(sqlValue);
              break;
            case 'gt':
              whereConditions.push(`${key} > ?`);
              whereValues.push(sqlValue);
              break;
            case 'gte':
              whereConditions.push(`${key} >= ?`);
              whereValues.push(sqlValue);
              break;
            case 'lt':
              whereConditions.push(`${key} < ?`);
              whereValues.push(sqlValue);
              break;
            case 'lte':
              whereConditions.push(`${key} <= ?`);
              whereValues.push(sqlValue);
              break;
            case 'in':
              if (Array.isArray(value)) {
                const placeholders = value.map(() => '?').join(', ');
                whereConditions.push(`${key} IN (${placeholders})`);
                whereValues.push(...value.map((v) => convertValueForSQLite(v)));
              } else {
                whereConditions.push(`${key} IN (?)`);
                whereValues.push(sqlValue);
              }
              break;
            case 'notIn':
              if (Array.isArray(value)) {
                const placeholders = value.map(() => '?').join(', ');
                whereConditions.push(`${key} NOT IN (${placeholders})`);
                whereValues.push(...value.map((v) => convertValueForSQLite(v)));
              } else {
                whereConditions.push(`${key} NOT IN (?)`);
                whereValues.push(sqlValue);
              }
              break;
            case 'like':
              whereConditions.push(`${key} LIKE ?`);
              whereValues.push(sqlValue);
              break;
            case 'notLike':
              whereConditions.push(`${key} NOT LIKE ?`);
              whereValues.push(sqlValue);
              break;
            case 'between':
              if (Array.isArray(value) && value.length === 2) {
                whereConditions.push(`${key} BETWEEN ? AND ?`);
                whereValues.push(convertValueForSQLite(value[0]), convertValueForSQLite(value[1]));
              } else {
                throw new Error('BETWEEN operator requires an array with exactly 2 values');
              }
              break;
            case 'notBetween':
              if (Array.isArray(value) && value.length === 2) {
                whereConditions.push(`${key} NOT BETWEEN ? AND ?`);
                whereValues.push(convertValueForSQLite(value[0]), convertValueForSQLite(value[1]));
              } else {
                throw new Error('NOT BETWEEN operator requires an array with exactly 2 values');
              }
              break;
            case 'null':
              whereConditions.push(`${key} IS ${value ? '' : 'NOT '}NULL`);
              break;
            case 'regex':
              whereConditions.push(`${key} REGEXP ?`);
              whereValues.push(sqlValue);
              break;
            case 'raw':
              whereConditions.push(String(value));
              break;
            default:
              throw new Error(`Unsupported operator: ${op}`);
          }
        }
      } else {
        // Simple equality
        const sqlValue = convertValueForSQLite(condition);
        if (sqlValue === null) {
          whereConditions.push(`${key} IS NULL`);
        } else if (sqlValue === undefined) {
          whereConditions.push(`${key} IS NULL`);
        } else if (Array.isArray(sqlValue)) {
          const placeholders = sqlValue.map(() => '?').join(', ');
          whereConditions.push(`${key} IN (${placeholders})`);
          whereValues.push(...sqlValue);
        } else if (typeof sqlValue === 'boolean') {
          whereConditions.push(`${key} = ?`);
          whereValues.push(sqlValue ? 1 : 0);
        } else if (sqlValue instanceof Date) {
          whereConditions.push(`${key} = ?`);
          whereValues.push(sqlValue.toISOString());
        } else if (typeof sqlValue === 'object') {
          whereConditions.push(`${key} = ?`);
          whereValues.push(JSON.stringify(sqlValue));
        } else {
          whereConditions.push(`${key} = ?`);
          whereValues.push(sqlValue);
        }
      }
    }

    // Build the base SQL
    let sql: string;
    let allValues: any[] = [];

    // Handle UPSERT (INSERT OR UPDATE)
    if (options.upsert) {
      const { onConflict, conflictValues } = options.upsert;
      const conflictColumns = Array.isArray(onConflict) ? onConflict : [onConflict];

      const allColumns = [
        ...new Set([...Object.keys(updateValues), ...Object.keys(conflictValues || {})]),
      ];

      const insertPlaceholders = allColumns.map(() => '?');

      sql = `INSERT INTO ${tableName} (${allColumns.join(', ')})
        VALUES (${insertPlaceholders.join(', ')})
        ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET
        ${setClauses.join(', ')}`;

      // Values for INSERT part
      for (const column of allColumns) {
        if (updateValues[column] !== undefined) {
          allValues.push(convertValueForSQLite(updateValues[column]));
        } else if (conflictValues && conflictValues[column] !== undefined) {
          allValues.push(convertValueForSQLite(conflictValues[column]));
        } else {
          allValues.push(null);
        }
      }

      // Values for UPDATE part
      allValues = [
        ...allValues,
        ...Object.keys(updateValues)
          .filter((key) => updateValues[key] !== undefined)
          .map((key) => convertValueForSQLite(updateValues[key])),
      ];
    } else {
      // Regular UPDATE
      if (whereConditions.length === 0) {
        throw new Error('No valid conditions in where clause');
      }

      sql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${whereConditions.join(
        ' AND ',
      )}`;

      // Add limit if specified
      if (options.limit && typeof options.limit === 'number') {
        sql += ` LIMIT ${options.limit}`;
      }

      allValues = [
        ...Object.keys(updateValues)
          .filter((key) => updateValues[key] !== undefined)
          .map((key) => convertValueForSQLite(updateValues[key])),
        ...whereValues,
      ];
    }

    // Add RETURNING clause if requested
    let returningClause = '';
    if (options.returning) {
      if (options.returning === true) {
        returningClause = ' RETURNING *';
      } else if (Array.isArray(options.returning) && options.returning.length > 0) {
        returningClause = ` RETURNING ${options.returning.join(', ')}`;
      }
      sql += returningClause;
    }

    try {
      // Use transaction if provided
      const executor = options.transaction || db;
      const stmt = executor.prepare(sql);

      // Skip actual DB changes during dry runs
      if (options.ignoreChanges) {
        return { changes: 0 };
      }

      const result = stmt.run(...allValues);

      const response: { changes: number; returning?: any[] } = {
        changes: Number(result.changes),
      };

      // Handle returning data
      if (returningClause && result.lastInsertRowid) {
        const returningSql = `SELECT ${
          options.returning === true ? '*' : (options.returning as string[]).join(', ')
        } 
          FROM ${tableName} WHERE rowid = ?`;
        const returningStmt = executor.prepare(returningSql);
        const returningRows = returningStmt.all(result.lastInsertRowid);
        response.returning = returningRows;
      }

      return response;
    } catch (error) {
      console.error(`Update error: ${sql}`, allValues);
      throw new Error(`Update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}
