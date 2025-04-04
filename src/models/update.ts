import type { DatabaseSync } from 'node:sqlite';
import { convertValueForSQLite } from '../utils/queryHelpers.js';
import { UpdateOptions } from '../Types.mjs';

export function createUpdateMethod(
  db: DatabaseSync,
  {
    tableName,
    options: modelOptions,
    attributes,
  }: { tableName: string; options?: any; attributes: Record<string, any> },
) {
  const executeWithRetry = async <T>(
    fn: () => Promise<T>,
    options: UpdateOptions,
    attempt = 1,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (
        options.onError !== 'retry' ||
        !options.retryOptions ||
        attempt >= options.retryOptions.attempts
      ) {
        if (options.onError === 'ignore') return { changes: 0 } as T;
        throw error;
      }
      const delay =
        options.retryOptions.backoff === 'exponential'
          ? options.retryOptions.delay * 2 ** (attempt - 1)
          : options.retryOptions.delay;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return executeWithRetry(fn, options, attempt + 1);
    }
  };

  const executeWithTimeout = <T>(fn: () => Promise<T>, timeout?: number): Promise<T> =>
    timeout && timeout > 0
      ? Promise.race<T>([
          fn(),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout),
          ),
        ])
      : fn();

  const processValues = async (values: Record<string, any>, options: UpdateOptions) => {
    let processed = modelOptions?.timestamps ? { ...values, updatedAt: new Date() } : { ...values };
    processed = options.beforeUpdate ? await options.beforeUpdate(processed) : processed;
    if (options.validate && !(await options.validate(processed)))
      throw new Error('Validation failed');
    return Object.fromEntries(
      Object.entries(processed)
        .filter(([key]) => attributes[key])
        .map(([key, value]) => {
          if (key === 'updatedAt' && value instanceof Date) {
            // Convert Date to Unix timestamp (milliseconds) for INTEGER columns
            return [key, value.getTime()];
          }
          return [key, convertValueForSQLite(value)];
        }),
    );
  };

  const buildWhereClause = (where: Record<string, any> | string = {}) => {
    const conditions: string[] = [];
    const values: any[] = [];

    for (const [key, condition] of Object.entries(where)) {
      if (!attributes[key]) continue;
      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        for (const [op, value] of Object.entries(condition)) {
          const sqlValue = convertValueForSQLite(value);
          switch (op) {
            case 'eq':
              conditions.push(`${key} = ?`);
              values.push(sqlValue);
              break;
            case 'ne':
              conditions.push(`${key} != ?`);
              values.push(sqlValue);
              break;
            case 'gt':
              conditions.push(`${key} > ?`);
              values.push(sqlValue);
              break;
            case 'gte':
              conditions.push(`${key} >= ?`);
              values.push(sqlValue);
              break;
            case 'lt':
              conditions.push(`${key} < ?`);
              values.push(sqlValue);
              break;
            case 'lte':
              conditions.push(`${key} <= ?`);
              values.push(sqlValue);
              break;
            case 'in':
              conditions.push(
                `${key} IN (${Array.isArray(value) ? value.map(() => '?').join(', ') : '?'})`,
              );
              values.push(
                ...(Array.isArray(value) ? value.map(convertValueForSQLite) : [sqlValue]),
              );
              break;
            case 'notIn':
              conditions.push(
                `${key} NOT IN (${Array.isArray(value) ? value.map(() => '?').join(', ') : '?'})`,
              );
              values.push(
                ...(Array.isArray(value) ? value.map(convertValueForSQLite) : [sqlValue]),
              );
              break;
            case 'like':
              conditions.push(`${key} LIKE ?`);
              values.push(sqlValue);
              break;
            case 'notLike':
              conditions.push(`${key} NOT LIKE ?`);
              values.push(sqlValue);
              break;
            case 'between':
              if (Array.isArray(value) && value.length === 2) {
                conditions.push(`${key} BETWEEN ? AND ?`);
                values.push(convertValueForSQLite(value[0]), convertValueForSQLite(value[1]));
              }
              break;
            case 'notBetween':
              if (Array.isArray(value) && value.length === 2) {
                conditions.push(`${key} NOT BETWEEN ? AND ?`);
                values.push(convertValueForSQLite(value[0]), convertValueForSQLite(value[1]));
              }
              break;
            case 'null':
              conditions.push(`${key} IS ${value ? '' : 'NOT '}NULL`);
              break;
            case 'regex':
              conditions.push(`${key} REGEXP ?`);
              values.push(sqlValue);
              break;
            case 'raw':
              conditions.push(String(value));
              break;
          }
        }
      } else {
        const sqlValue = convertValueForSQLite(condition);
        if (sqlValue == null) conditions.push(`${key} IS NULL`);
        else if (Array.isArray(sqlValue)) {
          conditions.push(`${key} IN (${sqlValue.map(() => '?').join(', ')})`);
          values.push(...sqlValue);
        } else {
          conditions.push(`${key} = ?`);
          values.push(
            sqlValue instanceof Date
              ? sqlValue.toISOString()
              : typeof sqlValue === 'object'
              ? JSON.stringify(sqlValue)
              : sqlValue,
          );
        }
      }
    }
    return { conditions: conditions.length ? conditions.join(' AND ') : '1=1', values };
  };

  const applyMergeStrategy = (
    existing: Record<string, any>,
    incoming: Record<string, any>,
    strategy: UpdateOptions['upsert'],
    columns: string[],
  ) => {
    const merged = { ...existing };
    const mergeFn =
      typeof strategy === 'function'
        ? strategy
        : strategy?.mergeStrategy === 'preserve'
        ? (curr: any, inc: any) => curr ?? inc
        : strategy?.mergeStrategy === 'append'
        ? (curr: any, inc: any) =>
            typeof curr === 'string' && typeof inc === 'string' ? curr + inc : inc
        : strategy?.mergeStrategy === 'numeric'
        ? (curr: any, inc: any) =>
            typeof curr === 'number' && typeof inc === 'number' ? curr + inc : inc
        : (_: any, inc: any) => inc;
    columns.forEach((key) => (merged[key] = mergeFn(existing[key], incoming[key])));
    return merged;
  };

  const updateSingle = async (values: Record<string, any>, options: UpdateOptions = {}) => {
    if (!options.where && !options.upsert)
      throw new Error('Where clause or upsert configuration required');

    let processed = await processValues(values, options);
    const setClauses = Object.keys(processed).map((key) => `${key} = ?`);
    if (!setClauses.length) throw new Error('No valid values provided');

    const { conditions, values: whereValues } = buildWhereClause(options.where);
    const returningClause = options.returning
      ? ` RETURNING ${
          options.returning === true ? '*' : (options.returning as string[]).join(', ')
        }`
      : '';
    const orderClause = options.orderBy?.length
      ? ` ORDER BY ${options.orderBy.map(([col, dir]) => `${col} ${dir}`).join(', ')}`
      : '';
    const limitClause = options.limit ? ` LIMIT ${options.limit}` : '';

    const executor =
      options.transaction === 'new'
        ? db
        : options.transaction === 'required'
        ? db
        : options.transaction || db;
    const inTransaction = options.transaction === 'new' || options.transaction === 'required';
    inTransaction && (executor as DatabaseSync).exec('BEGIN TRANSACTION');

    try {
      let sql: string,
        allValues: any[],
        changes: number,
        returnedRecords: any[] = [];

      if (options.upsert) {
        const { onConflict, conflictValues, mergeStrategy } = options.upsert;
        const conflictColumns = (Array.isArray(onConflict) ? onConflict : [onConflict]).filter(
          (col) => attributes[col],
        );
        const allColumns = [
          ...new Set([...Object.keys(processed), ...Object.keys(conflictValues || {})]),
        ];

        if (mergeStrategy) {
          const existing = db
            .prepare(
              `SELECT * FROM ${tableName} WHERE ${conflictColumns
                .map((c) => `${c} = ?`)
                .join(' AND ')}`,
            )
            .get(...conflictColumns.map((c) => processed[c] || conflictValues[c]));
          if (existing) {
            processed = applyMergeStrategy(
              existing,
              processed,
              { onConflict, conflictValues, mergeStrategy },
              Object.keys(processed),
            );
          }
        }

        sql = `INSERT INTO ${tableName} (${allColumns.join(', ')}) VALUES (${allColumns
          .map(() => '?')
          .join(', ')})
          ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET ${setClauses.join(
          ', ',
        )}${returningClause}`;
        allValues = [
          ...allColumns.map((col) => processed[col] ?? conflictValues[col] ?? null),
          ...Object.values(processed),
        ];
      } else {
        sql = `UPDATE ${tableName} SET ${setClauses.join(
          ', ',
        )} WHERE ${conditions}${orderClause}${limitClause}${returningClause}`;
        allValues = [...Object.values(processed), ...whereValues];
      }

      if (options.dryRun) {
        inTransaction && (executor as DatabaseSync).exec('ROLLBACK');
        return { changes: 1, returning: options.returning ? [processed] : undefined };
      }

      if (executor === 'none') throw new Error('No executor available');
      const stmt = executor.prepare(sql);
      const result = returningClause ? stmt.all(...allValues) : stmt.run(...allValues);
      changes = returningClause ? (result as any[]).length : Number((result as any).changes);
      returnedRecords = returningClause ? (result as any[]) : [];

      options.afterUpdate?.({ changes, updatedRecords: returnedRecords });
      inTransaction && (executor as DatabaseSync).exec('COMMIT');
      return { changes, returning: options.returning ? returnedRecords : undefined };
    } catch (error) {
      inTransaction && (executor as DatabaseSync).exec('ROLLBACK');
      throw error;
    }
  };

  const updateBatch = async (
    values: Record<string, any>,
    options: UpdateOptions & { batchSize: number },
  ) => {
    const { conditions, values: whereValues } = buildWhereClause(options.where);
    const countStmt = db
      .prepare(`SELECT COUNT(*) as total FROM ${tableName} WHERE ${conditions}`)
      .get(...whereValues);
    const total = (countStmt as any).total;
    let changes = 0,
      returnedRecords: any[] = [];

    const inTransaction = options.transaction === 'required' || options.transaction === 'new';
    inTransaction && db.exec('BEGIN TRANSACTION');

    try {
      for (let offset = 0; offset < total; offset += options.batchSize) {
        const batchOptions = {
          ...options,
          limit: options.batchSize,
          orderBy: options.orderBy || [['rowid', 'ASC']],
          transaction: 'none' as const,
        };
        const result = await updateSingle(values, batchOptions);
        changes += result.changes;
        if (options.returning) returnedRecords.push(...(result.returning || []));
      }
      inTransaction && db.exec('COMMIT');
      return { changes, returning: options.returning ? returnedRecords : undefined };
    } catch (error) {
      inTransaction && db.exec('ROLLBACK');
      throw error;
    }
  };

  return async (values: Record<string, any>, options: UpdateOptions = {}) =>
    executeWithTimeout(
      () =>
        executeWithRetry(
          () =>
            options.batchSize && options.where && !options.upsert
              ? updateBatch(values, { ...options, batchSize: options.batchSize })
              : updateSingle(values, options),
          options,
        ),
      options.timeout,
    );
}
