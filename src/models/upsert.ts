import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { convertValueForSQLite } from '../utils/queryHelpers.js';

// Type definitions for new features
type UpsertHook = (
  values: Record<string, any>,
) => Record<string, any> | Promise<Record<string, any>>;
type AfterUpsertHook = (result: {
  id: number | bigint;
  values: Record<string, any>;
  isNew: boolean;
}) => void | Promise<void>;
type MergeStrategy =
  | 'replace'
  | 'preserve'
  | 'append'
  | 'numeric'
  | ((current: any, incoming: any) => any);

interface UpsertOptions {
  conflictTarget?: string | string[];
  updateExclude?: string[];
  updateOnly?: string[];
  mergeStrategy?: MergeStrategy;
  where?: Record<string, any>;
  returning?: string | string[];
  beforeUpsert?: UpsertHook;
  afterUpsert?: AfterUpsertHook;
  dryRun?: boolean;
  bulk?: boolean;
  timeout?: number;
  onError?: 'abort' | 'ignore' | 'retry';
  retryOptions?: {
    attempts: number;
    backoff: 'fixed' | 'exponential';
    delay: number;
  };
}

export function createUpsertMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  return async function upsert(
    values: Record<string, any> | Record<string, any>[],
    options: UpsertOptions = {},
  ): Promise<{
    changes: number;
    lastInsertRowid: number | bigint;
    returnedRecords?: Record<string, any>[];
  }> {
    // Handle bulk operations if array is passed
    if (Array.isArray(values) && options.bulk) {
      return handleBulkUpsert(values, options);
    }

    // Convert single array item to object for standard processing
    const recordValues = Array.isArray(values) ? values[0] : values;

    // Apply beforeUpsert hook if provided
    let processedValues = recordValues;
    if (options.beforeUpsert) {
      processedValues = await options.beforeUpsert(recordValues);
    }

    // Convert values to SQLite compatible format
    const sqlValues = Object.entries(processedValues)
      .filter(([key]) => attributes[key] !== undefined) // Only allow defined attributes
      .map(([_, value]) => convertValueForSQLite(value));

    // Get valid columns that exist in model definition
    const validColumns = Object.keys(processedValues).filter(
      (key) => attributes[key] !== undefined,
    );

    if (validColumns.length === 0) {
      throw new Error('No valid columns provided for upsert');
    }

    // Build conflict target clause
    let conflictTargetClause = '';
    let conflictTargets: string[] = [];

    if (options.conflictTarget) {
      conflictTargets = Array.isArray(options.conflictTarget)
        ? options.conflictTarget
        : [options.conflictTarget];

      const validTargets = conflictTargets.filter((t) => attributes[t] !== undefined);

      if (validTargets.length > 0) {
        conflictTargetClause = `ON CONFLICT (${validTargets.join(', ')})`;
        conflictTargets = validTargets;
      }
    } else {
      // Default to primary key if no conflict target specified
      const primaryKeys = Object.entries(attributes)
        .filter(([_, def]) => def.primaryKey)
        .map(([key]) => key);

      if (primaryKeys.length > 0) {
        conflictTargetClause = `ON CONFLICT (${primaryKeys.join(', ')})`;
        conflictTargets = primaryKeys;
      }
    }

    // Build update clause
    let updateClause = '';
    if (options.updateOnly) {
      // Only update specific columns
      const columnsToUpdate = options.updateOnly.filter((col) => attributes[col] !== undefined);
      updateClause = columnsToUpdate.map((col) => `${col} = excluded.${col}`).join(', ');
    } else if (options.updateExclude) {
      // Update all columns except excluded ones
      const columnsToUpdate = validColumns.filter((col) => !options.updateExclude?.includes(col));
      updateClause = columnsToUpdate.map((col) => `${col} = excluded.${col}`).join(', ');
    } else {
      // Default: update all columns
      updateClause = validColumns.map((col) => `${col} = excluded.${col}`).join(', ');
    }

    // Add WHERE condition for conflict case if specified
    let whereClause = '';
    const whereValues: any[] = [];
    if (options.where) {
      const whereConditions = Object.entries(options.where)
        .filter(([key]) => attributes[key] !== undefined)
        .map(([key, value]) => {
          whereValues.push(convertValueForSQLite(value));
          return `${key} = ?`;
        });

      if (whereConditions.length > 0) {
        whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      }
    }

    // Handle RETURNING clause for getting back inserted/updated records
    let returningClause = '';
    if (options.returning) {
      const returningColumns = Array.isArray(options.returning)
        ? options.returning
        : [options.returning];

      const validReturningColumns = returningColumns.filter((col) => attributes[col] !== undefined);

      if (validReturningColumns.length > 0) {
        returningClause = `RETURNING ${validReturningColumns.join(', ')}`;
      } else {
        returningClause = 'RETURNING *';
      }
    }

    // Handle custom merge strategies
    if (options.mergeStrategy) {
      // Begin transaction for all merge strategies
      db.exec('BEGIN TRANSACTION');

      try {
        // Check for existing record
        let selectSql = `SELECT * FROM ${tableName} WHERE `;
        const whereConditions: string[] = [];
        const selectValues: any[] = [];

        conflictTargets.forEach((target) => {
          whereConditions.push(`${target} = ?`);
          selectValues.push(processedValues[target]);
        });

        selectSql += whereConditions.join(' AND ');
        const existing = db.prepare(selectSql).get(...selectValues) as Record<string, any>;

        let mergedValues: Record<string, any> = { ...processedValues };
        let isNew = !existing;

        if (existing) {
          // Apply appropriate merge strategy
          if (typeof options.mergeStrategy === 'function') {
            // Custom function strategy
            mergedValues = {};
            for (const key of validColumns) {
              mergedValues[key] = options.mergeStrategy(existing[key], processedValues[key]);
            }
          } else if (options.mergeStrategy === 'preserve') {
            // Only update fields that are null or undefined in existing record
            mergedValues = { ...existing };
            for (const key of validColumns) {
              if (existing[key] === null || existing[key] === undefined) {
                mergedValues[key] = processedValues[key];
              }
            }
          } else if (options.mergeStrategy === 'append') {
            // For string fields, append new content
            mergedValues = { ...existing };
            for (const key of validColumns) {
              if (typeof existing[key] === 'string' && typeof processedValues[key] === 'string') {
                mergedValues[key] = existing[key] + processedValues[key];
              } else {
                mergedValues[key] = processedValues[key];
              }
            }
          } else if (options.mergeStrategy === 'numeric') {
            // For numeric fields, add values
            mergedValues = { ...existing };
            for (const key of validColumns) {
              if (typeof existing[key] === 'number' && typeof processedValues[key] === 'number') {
                mergedValues[key] = existing[key] + processedValues[key];
              } else {
                mergedValues[key] = processedValues[key];
              }
            }
          }
          // Default is 'replace' which just uses the incoming values

          // Update with merged values
          const updateSql = `UPDATE ${tableName} SET ${validColumns
            .map((col) => `${col} = ?`)
            .join(', ')} WHERE ${whereConditions.join(' AND ')}`;
          const updateValues = [
            ...validColumns.map((col) => convertValueForSQLite(mergedValues[col])),
            ...selectValues,
          ];

          // Check for dry run
          if (options.dryRun) {
            db.exec('ROLLBACK');
            return {
              changes: 1,
              lastInsertRowid: existing.id,
              returnedRecords: [mergedValues],
            };
          }

          const result = db.prepare(updateSql).run(...updateValues);

          if (options.afterUpsert) {
            await options.afterUpsert({
              id: existing.id,
              values: mergedValues,
              isNew: false,
            });
          }

          db.exec('COMMIT');
          return {
            changes: Number(result.changes),
            lastInsertRowid: existing.id,
            returnedRecords: options.returning ? [mergedValues] : undefined,
          };
        } else {
          // Insert new record
          if (options.dryRun) {
            db.exec('ROLLBACK');
            return {
              changes: 1,
              lastInsertRowid: -1,
              returnedRecords: [mergedValues],
            };
          }

          const insertSql = `INSERT INTO ${tableName} (${validColumns.join(
            ', ',
          )}) VALUES (${validColumns.map(() => '?').join(', ')})`;
          const insertValues = validColumns.map((col) => convertValueForSQLite(mergedValues[col]));

          const insertResult = db.prepare(insertSql).run(...insertValues);

          if (options.afterUpsert) {
            await options.afterUpsert({
              id: insertResult.lastInsertRowid,
              values: mergedValues,
              isNew: true,
            });
          }

          db.exec('COMMIT');
          return {
            changes: Number(insertResult.changes),
            lastInsertRowid: insertResult.lastInsertRowid,
            returnedRecords: options.returning ? [mergedValues] : undefined,
          };
        }
      } catch (error) {
        db.exec('ROLLBACK');

        if (options.onError === 'retry' && options.retryOptions) {
          return handleRetry(processedValues, options, error, 1);
        }

        if (options.onError === 'ignore') {
          return { changes: 0, lastInsertRowid: -1 };
        }

        throw error;
      }
    }

    // Apply timeout if specified
    let timeoutId: NodeJS.Timeout | null = null;
    if (options.timeout && options.timeout > 0) {
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Upsert operation timed out after ${options.timeout}ms`));
        }, options.timeout);

        executeStandardUpsert()
          .then((result) => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(error);
          });
      });
    }

    // For standard operations without custom merge
    return executeStandardUpsert();

    // Helper function for standard upsert execution
    async function executeStandardUpsert() {
      // If dry run, return without executing
      if (options.dryRun) {
        return {
          changes: 1,
          lastInsertRowid: -1,
          returnedRecords: options.returning ? [processedValues] : undefined,
        };
      }

      // Build final SQL
      const sql = `
        INSERT INTO ${tableName} (${validColumns.join(', ')})
        VALUES (${validColumns.map(() => '?').join(', ')})
        ${conflictTargetClause}
        DO UPDATE SET ${updateClause}
        ${whereClause}
        ${returningClause}
      `.trim();

      try {
        const stmt = db.prepare(sql);
        const result = stmt.run(...[...sqlValues, ...whereValues]);

        const returnedRecords = options.returning
          ? [processedValues] // Simplified; in real implementation you'd get this from the RETURNING clause
          : undefined;

        // Determine if it was an insert or update based on changes count
        const isNew = Number(result.changes) === 1;

        if (options.afterUpsert) {
          await options.afterUpsert({
            id: result.lastInsertRowid,
            values: processedValues,
            isNew,
          });
        }

        return {
          changes: Number(result.changes),
          lastInsertRowid: result.lastInsertRowid,
          returnedRecords,
        };
      } catch (error) {
        if (options.onError === 'retry' && options.retryOptions) {
          return handleRetry(processedValues, options, error, 1);
        }

        if (options.onError === 'ignore') {
          return { changes: 0, lastInsertRowid: -1 };
        }

        throw new Error(`Upsert failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Helper function for bulk upsert
    async function handleBulkUpsert(items: Record<string, any>[], options: UpsertOptions) {
      // Start a transaction for the bulk operation
      db.exec('BEGIN TRANSACTION');

      let totalChanges = 0;
      let lastRowid: number | bigint = -1;
      const allReturnedRecords: Record<string, any>[] = [];

      try {
        for (const item of items) {
          // Recursively call upsert for each item, but within the same transaction
          const result = await upsert(item, {
            ...options,
            // Don't start a new transaction for each item
            bulk: false,
          });

          totalChanges += result.changes;
          lastRowid = result.lastInsertRowid;

          if (result.returnedRecords) {
            allReturnedRecords.push(...result.returnedRecords);
          }
        }

        db.exec('COMMIT');

        return {
          changes: totalChanges,
          lastInsertRowid: lastRowid,
          returnedRecords: options.returning ? allReturnedRecords : undefined,
        };
      } catch (error) {
        db.exec('ROLLBACK');

        if (options.onError === 'retry' && options.retryOptions) {
          return handleRetry(items, options, error, 1);
        }

        if (options.onError === 'ignore') {
          return {
            changes: totalChanges,
            lastInsertRowid: lastRowid,
            returnedRecords: options.returning ? allReturnedRecords : undefined,
          };
        }

        throw error;
      }
    }

    // Helper function for retry logic
    async function handleRetry(
      values: Record<string, any> | Record<string, any>[],
      options: UpsertOptions,
      error: any,
      attempt: number,
    ) {
      if (!options.retryOptions || attempt >= options.retryOptions.attempts) {
        throw error;
      }

      // Calculate delay based on retry strategy
      let delay = options.retryOptions.delay;
      if (options.retryOptions.backoff === 'exponential') {
        delay = options.retryOptions.delay * Math.pow(2, attempt - 1);
      }

      // Wait for the delay
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Try again with incremented attempt count
      return upsert(values, {
        ...options,
        retryOptions: {
          ...options.retryOptions,
          // Don't need to update attempts or other options
        },
      });
    }
  };
}
