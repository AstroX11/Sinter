import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition, DefineModelOptions, ModelAttributes } from '../Types.mjs';
import { generateCreateTableSQL } from './table-generator.js';
import { isSQLiteError } from '../Types.mjs';
import { generateTriggerSQL } from './trigger-generator.js';
import { addTimestamps, addParanoidField } from './schema-operations.mjs';
import { createIndexes } from './index-operations.js';
import { pluralize } from './utils.js';
import { validateModelAttributes } from './validation.mjs';
import { createModelCreateMethod } from '../models/create.js';
import { createFindOrCreateMethod } from '../models/findOrCreate.js';
import { createFindByPkMethod } from '../models/findByPk.js';
import { createFindOneMethod } from '../models/findOne.js';
import { createFindAllMethod } from '../models/findAll.js';
import { createMathMethods } from '../models/maths.js';
import { createIncrementDecrementMethods } from '../models/++--.js';
import { createBulkCreateMethod } from '../models/bulkCreate.js';
import { createUpdateMethod } from '../models/update.js';
import { createDestroyMethod } from '../models/destroy.js';
import { createTruncateMethod } from '../models/truncate.js';
import { createRestoreMethod } from '../models/restore.js';
import { createUpsertMethod } from '../models/upsert.js';

export function defineModel(
  db: DatabaseSync,
  models: Map<string, any>,
  modelName: string,
  attributes: ModelAttributes,
  options: DefineModelOptions,
) {
  const modelDefinition = createModelDefinition(modelName, attributes, options);

  try {
    db.exec(generateCreateTableSQL(modelDefinition));
    const execs = {
      definition: modelDefinition,
      create: createModelCreateMethod(db, modelDefinition),
      findOrCreate: createFindOrCreateMethod(db, modelDefinition),
      findByPk: createFindByPkMethod(db, modelDefinition),
      findOne: createFindOneMethod(db, modelDefinition),
      findAll: createFindAllMethod(db, modelDefinition),
      findAndCountAll: createFindAllMethod(db, modelDefinition),
      count: createMathMethods(db, modelDefinition).count,
      max: createMathMethods(db, modelDefinition).max,
      min: createMathMethods(db, modelDefinition).min,
      sum: createMathMethods(db, modelDefinition).sum,
      increment: createIncrementDecrementMethods(db, modelDefinition).increment,
      decrement: createIncrementDecrementMethods(db, modelDefinition).decrement,
      bulkCreate: createBulkCreateMethod(db, modelDefinition),
      update: createUpdateMethod(db, modelDefinition),
      destroy: createDestroyMethod(db, modelDefinition),
      truncate: createTruncateMethod(db, modelDefinition),
      restore: createRestoreMethod(db, modelDefinition),
      upsert: createUpsertMethod(db, modelDefinition),
    };

    models.set(modelName, execs);

    createIndexes(db, modelDefinition);
    const triggerSQLs = generateTriggerSQL(modelDefinition);
    triggerSQLs.forEach((sql) => db.exec(sql));

    return execs;
  } catch (error) {
    handleDefineError(error, modelName, modelDefinition);
    throw error;
  }
}

function createModelDefinition(
  modelName: string,
  attributes: ModelAttributes,
  options: DefineModelOptions,
): ModelDefinition {
  const tableName = getTableName(modelName, options);
  const modelDef: ModelDefinition = {
    attributes: { ...attributes }, // Safe copy
    options: {
      timestamps: options?.timestamps ?? true,
      paranoid: options?.paranoid ?? false,
      underscored: options?.underscored ?? false,
      freezeTableName: options?.freezeTableName ?? false,
      strict: options?.strict ?? true,
      ifNotExists: options?.ifNotExists ?? true,
      ...options,
    },
    tableName,
  };

  validateModelAttributes(modelName, attributes);
  addTimestamps(modelDef);
  addParanoidField(modelDef);
  return modelDef;
}

function getTableName(modelName: string, options: DefineModelOptions): string {
  if (options?.tableName) {
    return options?.freezeTableName ? options.tableName : pluralize(options.tableName);
  }
  return options?.freezeTableName ? modelName : pluralize(modelName);
}

function handleDefineError(error: unknown, modelName: string, def: ModelDefinition): unknown {
  if (
    isSQLiteError(error) &&
    error?.errstr?.includes('already exists') &&
    def.options?.ifNotExists
  ) {
    return;
  }
  throw new Error(
    `Failed to define model ${modelName}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
