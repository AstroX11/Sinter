import type { DatabaseSync } from 'node:sqlite';
import { convertValueForSQLite } from '../utils/queryHelpers.js';
import type { MergeStrategy, UpsertOptions } from '../Types.mjs';

export function createUpsertMethod(
  db: DatabaseSync,
  { tableName, attributes }: { tableName: string; attributes: Record<string, any> },
) {
  const executeWithRetry = async <T>(
    fn: () => Promise<T>,
    options: UpsertOptions,
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
        if (options.onError === 'ignore') return { changes: 0, lastInsertRowid: -1n } as T;
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
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout),
          ),
        ])
      : fn();

  const processValues = async (values: Record<string, any>, options: UpsertOptions) => {
    const processed = options.beforeUpsert ? await options.beforeUpsert(values) : values;
    if (options.validate && !(await options.validate(processed)))
      throw new Error('Validation failed');
    return Object.fromEntries(
      Object.entries(processed)
        .filter(([key]) => attributes[key])
        .map(([key, value]) => [key, convertValueForSQLite(value)]),
    );
  };

  const buildClauses = (values: Record<string, any>, options: UpsertOptions) => {
    const columns = Object.keys(values).filter((key) => attributes[key]);
    if (!columns.length) throw new Error('No valid columns');

    const conflictTargets = options.conflictTarget
      ? (Array.isArray(options.conflictTarget)
          ? options.conflictTarget
          : [options.conflictTarget]
        ).filter((t) => attributes[t])
      : Object.entries(attributes)
          .filter(([, def]) => def?.primaryKey)
          .map(([key]) => key);

    const conflictClause = conflictTargets.length
      ? `ON CONFLICT (${conflictTargets.join(', ')})`
      : '';

    const updateColumns =
      options.updateOnly?.filter((col) => attributes[col]) ||
      columns.filter((col) => !options.updateExclude?.includes(col));
    const updateClause = updateColumns.length
      ? `DO UPDATE SET ${updateColumns.map((col) => `${col} = excluded.${col}`).join(', ')}`
      : 'DO NOTHING';

    const whereClause =
      options.where &&
      Object.entries(options.where)
        .filter(([key]) => attributes[key])
        .map(([key]) => `${key} = ?`)
        .join(' AND ')
        ? `WHERE ${
            options.where &&
            Object.entries(options.where)
              .filter(([key]) => attributes[key])
              .map(([key]) => `${key} = ?`)
              .join(' AND ')
          }`
        : '';

    const returningClause = options?.returning
      ? `RETURNING ${
          (Array.isArray(options.returning) ? options.returning : [options.returning])
            .filter((col) => attributes[col])
            .join(', ') || '*'
        }`
      : '';

    return { columns, conflictClause, updateClause, whereClause, returningClause, conflictTargets };
  };

  const applyMergeStrategy = (
    existing: Record<string, any>,
    incoming: Record<string, any>,
    strategy: MergeStrategy,
    columns: string[],
  ) => {
    const merged = { ...existing };
    const mergeFn =
      typeof strategy === 'function'
        ? strategy
        : strategy === 'preserve'
        ? (curr: any, inc: any) => curr ?? inc
        : strategy === 'append'
        ? (curr: any, inc: any) =>
            typeof curr === 'string' && typeof inc === 'string' ? curr + inc : inc
        : strategy === 'numeric'
        ? (curr: any, inc: any) =>
            typeof curr === 'number' && typeof inc === 'number' ? curr + inc : inc
        : (_: any, inc: any) => inc;

    columns.forEach((key) => (merged[key] = mergeFn(existing[key], incoming[key])));
    return merged;
  };

  const upsertSingle = async (values: Record<string, any>, options: UpsertOptions) => {
    const processed = await processValues(values, options);
    const { columns, conflictClause, updateClause, whereClause, returningClause, conflictTargets } =
      buildClauses(processed, options);

    if (options.mergeStrategy && conflictTargets.length) {
      db.exec(options.transaction === 'new' ? 'BEGIN TRANSACTION' : '');
      try {
        const existing = db
          .prepare(
            `SELECT * FROM ${tableName} WHERE ${conflictTargets
              .map((t) => `${t} = ?`)
              .join(' AND ')}`,
          )
          .get(...conflictTargets.map((t) => processed[t])) as Record<string, any>;

        const finalValues = existing
          ? applyMergeStrategy(existing, processed, options.mergeStrategy, columns)
          : processed;

        if (options.dryRun) {
          options.transaction === 'new' && db.exec('ROLLBACK');
          return {
            changes: 1,
            lastInsertRowid: existing?.id || -1n,
            returnedRecords: [finalValues],
          };
        }

        const result = existing
          ? db
              .prepare(
                `UPDATE ${tableName} SET ${columns
                  .map((c) => `${c} = ?`)
                  .join(', ')} WHERE ${conflictTargets.map((t) => `${t} = ?`).join(' AND ')}`,
              )
              .run(
                ...columns.map((c) => finalValues[c]),
                ...conflictTargets.map((t) => finalValues[t]),
              )
          : db
              .prepare(
                `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns
                  .map(() => '?')
                  .join(', ')})`,
              )
              .run(...columns.map((c) => finalValues[c]));

        options.afterUpsert?.({
          id: result.lastInsertRowid,
          values: finalValues,
          isNew: !existing,
        });
        options.transaction === 'new' && db.exec('COMMIT');
        return {
          changes: Number(result.changes),
          lastInsertRowid: result.lastInsertRowid,
          returnedRecords: options.returning ? [finalValues] : undefined,
        };
      } catch (error) {
        options.transaction === 'new' && db.exec('ROLLBACK');
        throw error;
      }
    }

    if (options.dryRun) return { changes: 1, lastInsertRowid: -1n, returnedRecords: [processed] };

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns
      .map(() => '?')
      .join(', ')}) ${conflictClause} ${updateClause} ${whereClause} ${returningClause}`;
    const result = db
      .prepare(sql)
      .run(
        ...columns.map((c) => processed[c]),
        ...(options.where ? Object.values(options.where).map(convertValueForSQLite) : []),
      );

    options.afterUpsert?.({
      id: result.lastInsertRowid,
      values: processed,
      isNew: Number(result.changes) === 1,
    });
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid,
      returnedRecords: options.returning ? [processed] : undefined,
    };
  };

  const upsertBulk = async (items: Record<string, any>[], options: UpsertOptions) => {
    const batchSize = options.batchSize || 1000;
    let totalChanges = 0,
      lastRowid = -1n,
      returnedRecords: Record<string, any>[] = [];

    const inTransaction = options.transaction === 'required' || options.transaction === 'new';
    inTransaction && db.exec('BEGIN TRANSACTION');

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((item) => upsertSingle(item, { ...options, transaction: 'none' })),
        );

        totalChanges += batchResults.reduce((sum, r) => sum + r.changes, 0);
        lastRowid = batchResults[batchResults.length - 1].lastInsertRowid;
        options.returning &&
          returnedRecords.push(...batchResults.flatMap((r) => r.returnedRecords || []));
      }

      inTransaction && db.exec('COMMIT');
      return {
        changes: totalChanges,
        lastInsertRowid: lastRowid,
        returnedRecords: options.returning ? returnedRecords : undefined,
      };
    } catch (error) {
      inTransaction && db.exec('ROLLBACK');
      throw error;
    }
  };

  return async (values: Record<string, any> | Record<string, any>[], options: UpsertOptions = {}) =>
    executeWithTimeout(
      () =>
        executeWithRetry(
          () =>
            Array.isArray(values) && options.bulk
              ? upsertBulk(values, options)
              : upsertSingle(Array.isArray(values) ? values[0] : values, options),
          options,
        ),
      options.timeout,
    );
}
