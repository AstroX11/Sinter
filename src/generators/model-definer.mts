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
    const model = {
      definition: modelDefinition,
      create: createModelCreateMethod(db, modelDefinition),
    };

    models.set(modelName, model);

    createIndexes(db, modelDefinition);
    const triggerSQLs = generateTriggerSQL(modelDefinition);
    triggerSQLs.forEach((sql) => db.exec(sql));

    return model;
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
