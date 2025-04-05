import { createModelCreateMethod } from './create.js';
import { createFindOrCreateMethod } from './findOrCreate.js';
import { createFindByPkMethod } from './findByPk.js';
import { createFindOneMethod } from './findOne.js';
import { createFindAllMethod } from './findAll.js';
import { createMathMethods } from './maths.js';
import { createIncrementDecrementMethods } from './min_max.js';
import { createBulkCreateMethod } from './bulkCreate.js';
import { createUpdateMethod } from './update.js';
import { createDestroyMethod } from './destroy.js';
import { createTruncateMethod } from './truncate.js';
import { createRestoreMethod } from './restore.js';
import { createUpsertMethod } from './upsert.js';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseExtraSettings, ModelDefinition } from '../Types.mjs';

/**
 * Creates a model instance with database operation methods
 * @param {DatabaseSync} db - The SQLite database connection
 * @param {ModelDefinition} modelDefinition - The model definition configuration
 */
export const ModelFunctions = (
  db: DatabaseSync,
  modelDefinition: ModelDefinition,
  optionsDB: DatabaseExtraSettings,
) => {
  const log = (message: string) => optionsDB.verbose && console.log(`[ModelFunctions] ${message}`);

  return {
    create: (...args: Parameters<ReturnType<typeof createModelCreateMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Creating record with args: ${JSON.stringify(args)}`);
        try {
          const result = createModelCreateMethod(db, modelDefinition)(...args);
          log(`Created record: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error creating record: ${error}`);
          reject(error);
        }
      }),

    findOrCreate: (...args: Parameters<ReturnType<typeof createFindOrCreateMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Finding or creating with args: ${JSON.stringify(args)}`);
        try {
          const result = createFindOrCreateMethod(db, modelDefinition)(...args);
          log(`Found or created: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error in findOrCreate: ${error}`);
          reject(error);
        }
      }),

    findByPk: (...args: Parameters<ReturnType<typeof createFindByPkMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Finding by PK with args: ${JSON.stringify(args)}`);
        try {
          const result = createFindByPkMethod(db, modelDefinition)(...args);
          log(`Found by PK: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error finding by PK: ${error}`);
          reject(error);
        }
      }),

    findOne: (...args: Parameters<ReturnType<typeof createFindOneMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Finding one with args: ${JSON.stringify(args)}`);
        try {
          const result = createFindOneMethod(db, modelDefinition)(...args);
          log(`Found one: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error finding one: ${error}`);
          reject(error);
        }
      }),

    findAll: (...args: Parameters<ReturnType<typeof createFindAllMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Finding all with args: ${JSON.stringify(args)}`);
        try {
          const result = createFindAllMethod(db, modelDefinition)(...args);
          log(`Found all: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error finding all: ${error}`);
          reject(error);
        }
      }),

    findAndCountAll: (...args: Parameters<ReturnType<typeof createFindAllMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Finding and counting all with args: ${JSON.stringify(args)}`);
        try {
          const result = createFindAllMethod(db, modelDefinition)(...args);
          log(`Found and counted all: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error finding and counting all: ${error}`);
          reject(error);
        }
      }),

    count: (...args: Parameters<ReturnType<typeof createMathMethods>['count']>) =>
      new Promise((resolve, reject) => {
        log(`Counting with args: ${JSON.stringify(args)}`);
        try {
          const result = createMathMethods(db, modelDefinition).count(...args);
          log(`Count result: ${result}`);
          resolve(result);
        } catch (error) {
          log(`Error counting: ${error}`);
          reject(error);
        }
      }),

    max: (...args: Parameters<ReturnType<typeof createMathMethods>['max']>) =>
      new Promise((resolve, reject) => {
        log(`Finding max with args: ${JSON.stringify(args)}`);
        try {
          const result = createMathMethods(db, modelDefinition).max(...args);
          log(`Max result: ${result}`);
          resolve(result);
        } catch (error) {
          log(`Error finding max: ${error}`);
          reject(error);
        }
      }),

    min: (...args: Parameters<ReturnType<typeof createMathMethods>['min']>) =>
      new Promise((resolve, reject) => {
        log(`Finding min with args: ${JSON.stringify(args)}`);
        try {
          const result = createMathMethods(db, modelDefinition).min(...args);
          log(`Min result: ${result}`);
          resolve(result);
        } catch (error) {
          log(`Error finding min: ${error}`);
          reject(error);
        }
      }),

    sum: (...args: Parameters<ReturnType<typeof createMathMethods>['sum']>) =>
      new Promise((resolve, reject) => {
        log(`Summing with args: ${JSON.stringify(args)}`);
        try {
          const result = createMathMethods(db, modelDefinition).sum(...args);
          log(`Sum result: ${result}`);
          resolve(result);
        } catch (error) {
          log(`Error summing: ${error}`);
          reject(error);
        }
      }),

    increment: (
      ...args: Parameters<ReturnType<typeof createIncrementDecrementMethods>['increment']>
    ) =>
      new Promise((resolve, reject) => {
        log(`Incrementing with args: ${JSON.stringify(args)}`);
        try {
          const result = createIncrementDecrementMethods(db, modelDefinition).increment(...args);
          log(`Incremented: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error incrementing: ${error}`);
          reject(error);
        }
      }),

    decrement: (
      ...args: Parameters<ReturnType<typeof createIncrementDecrementMethods>['decrement']>
    ) =>
      new Promise((resolve, reject) => {
        log(`Decrementing with args: ${JSON.stringify(args)}`);
        try {
          const result = createIncrementDecrementMethods(db, modelDefinition).decrement(...args);
          log(`Decremented: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error decrementing: ${error}`);
          reject(error);
        }
      }),

    bulkCreate: (...args: Parameters<ReturnType<typeof createBulkCreateMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Bulk creating with args: ${JSON.stringify(args)}`);
        try {
          const result = createBulkCreateMethod(db, modelDefinition)(...args);
          log(`Bulk created: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error bulk creating: ${error}`);
          reject(error);
        }
      }),

    update: (...args: Parameters<ReturnType<typeof createUpdateMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Updating with args: ${JSON.stringify(args)}`);
        try {
          const result = createUpdateMethod(db, modelDefinition)(...args);
          log(`Updated: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error updating: ${error}`);
          reject(error);
        }
      }),

    destroy: (...args: Parameters<ReturnType<typeof createDestroyMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Destroying with args: ${JSON.stringify(args)}`);
        try {
          const result = createDestroyMethod(db, modelDefinition)(...args);
          log(`Destroyed: ${result}`);
          resolve(result);
        } catch (error) {
          log(`Error destroying: ${error}`);
          reject(error);
        }
      }),

    truncate: (...args: Parameters<ReturnType<typeof createTruncateMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Truncating with args: ${JSON.stringify(args)}`);
        try {
          const result = createTruncateMethod(db, modelDefinition)(...args);
          log(`Truncated`);
          resolve(result);
        } catch (error) {
          log(`Error truncating: ${error}`);
          reject(error);
        }
      }),

    restore: (...args: Parameters<ReturnType<typeof createRestoreMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Restoring with args: ${JSON.stringify(args)}`);
        try {
          const result = createRestoreMethod(db, modelDefinition)(...args);
          log(`Restored: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error restoring: ${error}`);
          reject(error);
        }
      }),

    upsert: (...args: Parameters<ReturnType<typeof createUpsertMethod>>) =>
      new Promise((resolve, reject) => {
        log(`Upserting with args: ${JSON.stringify(args)}`);
        try {
          const result = createUpsertMethod(db, modelDefinition)(...args);
          log(`Upserted: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          log(`Error upserting: ${error}`);
          reject(error);
        }
      }),
  };
};

export type ModelFunctions = ReturnType<typeof ModelFunctions>;
