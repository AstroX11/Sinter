import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { convertValueForSQLite, sanitizeInput } from '../utils/queryHelpers.js';
import { DataTypes } from '../utils/datatypes.js';

export function createFindOneMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  return function findOne(
    options: {
      where?: Record<string, any>;
      order?: [string, 'ASC' | 'DESC' | 'RANDOM'][];
      select?: string[] | '*';
      joins?: {
        type: 'INNER' | 'LEFT' | 'RIGHT';
        table: string;
        on: Record<string, string>;
      }[];
      groupBy?: string[];
      having?: Record<string, any>;
      lock?: 'FOR UPDATE' | 'FOR SHARE';
      timeout?: number;
    } = {},
  ): Record<string, any> | undefined {
    const values: any[] = [];
    let sql = 'SELECT ';

    if (options?.select && options?.select !== '*') {
      const validColumns = options.select
        .filter((col) => attributes?.[col] || col.includes('.'))
        .map((col) => sanitizeInput(col));
      sql += validColumns.length > 0 ? validColumns.join(', ') : '*';
    } else {
      sql += '*';
    }

    sql += ` FROM ${sanitizeInput(tableName)}`;

    if (options?.joins?.length) {
      options.joins.forEach((join) => {
        sql += ` ${join?.type} JOIN ${sanitizeInput(join?.table)} ON `;
        const joinConditions = Object.entries(join?.on || {}).map(
          ([left, right]) => `${sanitizeInput(left)} = ${sanitizeInput(right)}`,
        );
        sql += joinConditions.join(' AND ');
      });
    }

    if (options?.where) {
      const whereClauses = Object.entries(options.where)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => {
          const sanitizedKey = sanitizeInput(key);
          if (value === null) {
            return `${sanitizedKey} IS NULL`;
          }
          if (typeof value === 'object' && !Array.isArray(value)) {
            const [op, val] = Object.entries(value)[0];
            values.push(convertValueForSQLite(val));
            return `${sanitizedKey} ${op} ?`;
          }
          values.push(convertValueForSQLite(value));
          return `${sanitizedKey} = ?`;
        });

      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
    }

    if (options?.groupBy?.length) {
      const validGroups = options.groupBy
        .filter((col) => attributes?.[col])
        .map((col) => sanitizeInput(col));
      if (validGroups.length > 0) {
        sql += ` GROUP BY ${validGroups.join(', ')}`;
      }
    }

    if (options?.having) {
      const havingClauses = Object.entries(options.having).map(([key, value]) => {
        const sanitizedKey = sanitizeInput(key);
        values.push(convertValueForSQLite(value));
        return `${sanitizedKey} = ?`;
      });
      if (havingClauses.length > 0) {
        sql += ` HAVING ${havingClauses.join(' AND ')}`;
      }
    }

    if (options?.order?.length) {
      const orderClauses = options.order.map(([col, dir]) => {
        const sanitizedCol = sanitizeInput(col);
        if (dir === 'RANDOM') return 'RANDOM()';
        return `${sanitizedCol} ${dir === 'DESC' ? 'DESC' : 'ASC'}`;
      });
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    sql += ' LIMIT 1';

    if (options?.lock) {
      sql += ` ${options.lock}`;
    }

    try {
      const stmt = db.prepare(sql);

      if (options?.timeout) {
        db.exec(`PRAGMA busy_timeout = ${options.timeout}`);
      }

      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const result = values.length > 0 ? stmt.get(...values) : stmt.get();

          if (result && attributes) {
            const typedResult = result as Record<string, any>;
            Object.keys(typedResult).forEach((key) => {
              const attr = attributes[key];
              if (attr?.type) {
                switch (attr.type) {
                  case 'STRING':
                  case 'TEXT':
                  case 'VARCHAR':
                    typedResult[key] = String(typedResult[key]);
                    if (DataTypes.DATE === attr.type) {
                      typedResult[key] = new Date(typedResult[key] as string);
                    }
                    break;
                  case 'INTEGER':
                    typedResult[key] = parseInt(typedResult[key] as string, 10);
                    if (DataTypes.BOOLEAN === attr.type) {
                      typedResult[key] = Boolean(typedResult[key]);
                    } else if (DataTypes.TIMESTAMP === attr.type) {
                      typedResult[key] = new Date(typedResult[key]);
                    }
                  case DataTypes.FLOAT:
                  case 'REAL':
                    typedResult[key] = parseFloat(typedResult[key] as string);
                    break;
                  case 'BLOB':
                    break;
                  case 'NULL':
                    typedResult[key] = null;
                    break;
                  case 'NUMERIC':
                    typedResult[key] = Number(typedResult[key]);
                    break;
                }
                if (attr?.transform) {
                  typedResult[key] = attr.transform(typedResult[key]);
                }
                if (attr?.get) {
                  typedResult[key] = attr.get.call(typedResult);
                }
              }
            });
            return typedResult;
          }

          return result as Record<string, any> | undefined;
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) throw error;
          const start = Date.now();
          while (Date.now() - start < 100 * attempts) {}
        }
      }
    } catch (error) {
      console.error('FindOne Error:', { sql, values, error: (error as Error).message });
      throw new Error(`Database query failed: ${(error as Error).message}`);
    }
  };
}
