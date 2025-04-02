import type { DatabaseSync } from 'node:sqlite';
import type {
  ModelDefinition,
  DefineModelOptions,
  ModelAttributes,
  ModelExports as Models,
} from '../Types.mjs';
import { pluralize } from './utils.js';
import { addTimestamps, addParanoidField, validateModelAttributes } from './schema.mjs';
import { generateCreateTableSQL } from './tables.js';
import { isSQLiteError } from '../Types.mjs';
import { generateTriggerSQL } from './triggers.js';
import { createIndexes } from './operations.js';
import { createModel } from '../models/index.js';

export function defineModel(
  db: DatabaseSync,
  model: Map<string, any>,
  modelName: string,
  attributes: ModelAttributes,
  options: DefineModelOptions,
) {
  const modelDefinition = createModelDefinition(modelName, attributes, options);

  try {
    db.exec(generateCreateTableSQL(modelDefinition));

    model.set(modelName, createModel(db, modelDefinition));

    createIndexes(db, modelDefinition);
    const triggerSQLs = generateTriggerSQL(modelDefinition);
    triggerSQLs.forEach((sql) => db.exec(sql));
    return createModel(db, modelDefinition);
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
  throw new Error(`Model Error: ${modelName}: ${error as Error}`);
}
