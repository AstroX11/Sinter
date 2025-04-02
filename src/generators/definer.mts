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
    const InstanceModels = {
      definition: modelDefinition,
      create: async (...args: Parameters<ReturnType<typeof createModelCreateMethod>>) => {
        return Promise.resolve(createModelCreateMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      findOrCreate: async (...args: Parameters<ReturnType<typeof createFindOrCreateMethod>>) => {
        return Promise.resolve(createFindOrCreateMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      findByPk: async (...args: Parameters<ReturnType<typeof createFindByPkMethod>>) => {
        return Promise.resolve(createFindByPkMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      findOne: async (...args: Parameters<ReturnType<typeof createFindOneMethod>>) => {
        return Promise.resolve(createFindOneMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      findAll: async (...args: Parameters<ReturnType<typeof createFindAllMethod>>) => {
        return Promise.resolve(createFindAllMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      findAndCountAll: async (...args: Parameters<ReturnType<typeof createFindAllMethod>>) => {
        return Promise.resolve(createFindAllMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      count: async (...args: Parameters<ReturnType<typeof createMathMethods>['count']>) => {
        return Promise.resolve(createMathMethods(db, modelDefinition).count(...args)).then(
          () => InstanceModels,
        );
      },
      max: async (...args: Parameters<ReturnType<typeof createMathMethods>['max']>) => {
        return Promise.resolve(createMathMethods(db, modelDefinition).max(...args)).then(
          () => InstanceModels,
        );
      },
      min: async (...args: Parameters<ReturnType<typeof createMathMethods>['min']>) => {
        return Promise.resolve(createMathMethods(db, modelDefinition).min(...args)).then(
          () => InstanceModels,
        );
      },
      sum: async (...args: Parameters<ReturnType<typeof createMathMethods>['sum']>) => {
        return Promise.resolve(createMathMethods(db, modelDefinition).sum(...args)).then(
          () => InstanceModels,
        );
      },
      increment: async (
        ...args: Parameters<ReturnType<typeof createIncrementDecrementMethods>['increment']>
      ) => {
        return Promise.resolve(
          createIncrementDecrementMethods(db, modelDefinition).increment(...args),
        ).then(() => InstanceModels);
      },
      decrement: async (
        ...args: Parameters<ReturnType<typeof createIncrementDecrementMethods>['decrement']>
      ) => {
        return Promise.resolve(
          createIncrementDecrementMethods(db, modelDefinition).decrement(...args),
        ).then(() => InstanceModels);
      },
      bulkCreate: async (...args: Parameters<ReturnType<typeof createBulkCreateMethod>>) => {
        return Promise.resolve(createBulkCreateMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      update: async (...args: Parameters<ReturnType<typeof createUpdateMethod>>) => {
        return Promise.resolve(createUpdateMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      destroy: async (...args: Parameters<ReturnType<typeof createDestroyMethod>>) => {
        return Promise.resolve(createDestroyMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      truncate: async (...args: Parameters<ReturnType<typeof createTruncateMethod>>) => {
        return Promise.resolve(createTruncateMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      restore: async (...args: Parameters<ReturnType<typeof createRestoreMethod>>) => {
        return Promise.resolve(createRestoreMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
      upsert: async (...args: Parameters<ReturnType<typeof createUpsertMethod>>) => {
        return Promise.resolve(createUpsertMethod(db, modelDefinition)(...args)).then(
          () => InstanceModels,
        );
      },
    };

    models.set(modelName, InstanceModels);

    createIndexes(db, modelDefinition);
    const triggerSQLs = generateTriggerSQL(modelDefinition);
    triggerSQLs.forEach((sql) => db.exec(sql));
    return InstanceModels;
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
