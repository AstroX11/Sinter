import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition, HookFunction } from '../Types.mjs';
import { convertToSqliteValue } from './utils.js';
import { executeHooks } from '../hooks/hookRunner.js';
import { getTransaction } from '../utils/transactions.js';
import { handleBatchInsert, validateValue } from '../generators/schema.mjs';

/**
 * Creates only the create method for a model
 * @param db DatabaseSync instance
 * @param modelDefinition The model definition
 * @returns The create function
 */
export function createModelCreateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes, options = {} } = modelDefinition;
  const hooks = options.hooks || {};

  /**
   * Creates a new record in the database
   * @param values Field values for the new record
   * @param options Additional options for creation
   * @returns The created record
   */
  return async function create(
    values: Record<string, any> = {},
    options: {
      transaction?: string;
      returnRaw?: boolean;
      skipHooks?: boolean;
      ignoreMissing?: boolean;
      batch?: boolean;
    } = {},
  ) {
    const txn = options.transaction ? getTransaction(db, options.transaction) : null;
    const dbContext = txn || db;
    const inputValues = { ...values };

    try {
      if (!options.skipHooks && hooks.beforeValidate) {
        await executeHooks(hooks.beforeValidate as HookFunction[], inputValues);
      }

      const processedValues: Record<string, any> = {};
      const validationErrors: string[] = [];
      const skippedFields: string[] = [];

      for (const [attrName, attrDef] of Object.entries(attributes)) {
        let value =
          inputValues[attrName] === undefined && attrDef.defaultValue !== undefined
            ? typeof attrDef.defaultValue === 'function'
              ? attrDef.defaultValue()
              : attrDef.defaultValue
            : inputValues[attrName];

        if (value === undefined) {
          if (attrDef.allowNull === false && !attrDef.autoIncrement) {
            validationErrors.push(`Field '${attrName}' cannot be null`);
          } else {
            skippedFields.push(attrName);
          }
          continue;
        }

        if (!options.ignoreMissing) {
          const validation = validateValue(value, attrDef);
          if (!validation.valid) {
            validationErrors.push(`Field '${attrName}': ${validation.errors.join(', ')}`);
            continue;
          }
        }

        processedValues[attrName] = convertToSqliteValue(
          attrDef.transform ? attrDef.transform(value) : value,
          attrDef.type,
        );
      }

      if (validationErrors.length > 0) {
        throw new Error(`Validation failed:\n- ${validationErrors.join('\n- ')}`);
      }

      if (!options.skipHooks && hooks.beforeCreate) {
        await executeHooks(hooks.beforeCreate as HookFunction[], processedValues);
      }

      if (options.batch && Array.isArray(values)) {
        return handleBatchInsert(dbContext, tableName, [processedValues], options);
      }

      const columns = Object.keys(processedValues);
      const placeholders = columns.map(() => '?').join(', ');
      const sqlValues = columns.map((col) => processedValues[col]);
      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

      const result = dbContext.prepare(sql).run(...sqlValues);
      const insertedId = result.lastInsertRowid;

      if (options.returnRaw) {
        return { id: insertedId, changes: result.changes, raw: processedValues };
      }

      let createdRecord = { ...processedValues, id: insertedId };

      if (!options.skipHooks && hooks.afterCreate) {
        createdRecord = dbContext
          .prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
          .get(insertedId) as Record<string, any> & { id: number | bigint };
        await executeHooks(hooks.afterCreate as HookFunction[], createdRecord);
      }

      return createdRecord;
    } catch (error) {
      if (!options.skipHooks && hooks.onError) {
        await executeHooks(hooks.onError as HookFunction[], {
          error,
          operation: 'create',
          values: inputValues,
        });
      }

      throw new Error(
        `Failed to create record in ${tableName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
}
