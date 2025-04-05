import type { DatabaseSync } from 'node:sqlite';
import type {
  ModelDefinition,
  DefineModelOptions,
  ModelAttributes,
  ModelExports as Models,
  DatabaseSyncOptions,
  DatabaseExtraSettings,
} from '../Types.mjs';
import {
  addTimestamps,
  addParanoidField,
  validateModelAttributes,
  getTableName,
} from './schema.js';
import { generateCreateTableSQL } from './tables.js';
import { isSQLiteError } from '../Types.mjs';
import { generateTriggerSQL } from './triggers.js';
import { createIndexes } from './schema.js';
import { ModelFunctions } from '../models/index.js';

export function defineModel(
  db: DatabaseSync,
  modelName: string,
  attributes: ModelAttributes,
  options: DefineModelOptions,
  optionsDB: DatabaseExtraSettings,
): ModelFunctions {
  const modelDefinition = createModelDefinition(modelName, attributes, options);

  try {
    db.exec(generateCreateTableSQL(modelDefinition));

    createIndexes(db, modelDefinition);
    const triggerSQLs = generateTriggerSQL(modelDefinition);
    triggerSQLs.forEach((sql) => db.exec(sql));
    return ModelFunctions(db, modelDefinition, optionsDB);
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
