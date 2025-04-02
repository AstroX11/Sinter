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
import type { ModelDefinition } from '../Types.mjs';

/**
 * Creates a model instance with database operation methods
 * @param {DatabaseSync} db - The SQLite database connection
 * @param {ModelDefinition} modelDefinition - The model definition configuration
 */
export const ModelFunctions = (db: DatabaseSync, modelDefinition: ModelDefinition) => ({
  /**
   * Creates a new record in the database
   * @param {...any[]} args - Arguments for record creation
   * @returns {Promise<any>} The created record
   */
  create: (...args: Parameters<ReturnType<typeof createModelCreateMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createModelCreateMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Finds or creates a record based on conditions
   * @param {...any[]} args - Arguments for find or create operation
   * @returns {Promise<any>} The found or created record
   */
  findOrCreate: (...args: Parameters<ReturnType<typeof createFindOrCreateMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createFindOrCreateMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Finds a record by primary key
   * @param {...any[]} args - Primary key and options
   * @returns {Promise<any>} The found record or null
   */
  findByPk: (...args: Parameters<ReturnType<typeof createFindByPkMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createFindByPkMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Finds one record matching the conditions
   * @param {...any[]} args - Query conditions
   * @returns {Promise<any>} The found record or null
   */
  findOne: (...args: Parameters<ReturnType<typeof createFindOneMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createFindOneMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Finds all records matching the conditions
   * @param {...any[]} args - Query conditions
   * @returns {Promise<any[]>} Array of matching records
   */
  findAll: (...args: Parameters<ReturnType<typeof createFindAllMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createFindAllMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Finds all records and counts them
   * @param {...any[]} args - Query conditions
   * @returns {Promise<any[]>} Array of matching records with count
   */
  findAndCountAll: (...args: Parameters<ReturnType<typeof createFindAllMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createFindAllMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Counts records matching the conditions
   * @param {...any[]} args - Query conditions
   * @returns {Promise<number>} Number of matching records
   */
  count: (...args: Parameters<ReturnType<typeof createMathMethods>['count']>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createMathMethods(db, modelDefinition).count(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Finds maximum value of a field
   * @param {...any[]} args - Field name and conditions
   * @returns {Promise<number>} Maximum value
   */
  max: (...args: Parameters<ReturnType<typeof createMathMethods>['max']>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createMathMethods(db, modelDefinition).max(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Finds minimum value of a field
   * @param {...any[]} args - Field name and conditions
   * @returns {Promise<number>} Minimum value
   */
  min: (...args: Parameters<ReturnType<typeof createMathMethods>['min']>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createMathMethods(db, modelDefinition).min(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Calculates sum of a field
   * @param {...any[]} args - Field name and conditions
   * @returns {Promise<number>} Sum of values
   */
  sum: (...args: Parameters<ReturnType<typeof createMathMethods>['sum']>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createMathMethods(db, modelDefinition).sum(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Increments field values
   * @param {...any[]} args - Fields to increment and conditions
   * @returns {Promise<any>} Updated records
   */
  increment: (
    ...args: Parameters<ReturnType<typeof createIncrementDecrementMethods>['increment']>
  ) =>
    new Promise((resolve, reject) => {
      try {
        const result = createIncrementDecrementMethods(db, modelDefinition).increment(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Decrements field values
   * @param {...any[]} args - Fields to decrement and conditions
   * @returns {Promise<any>} Updated records
   */
  decrement: (
    ...args: Parameters<ReturnType<typeof createIncrementDecrementMethods>['decrement']>
  ) =>
    new Promise((resolve, reject) => {
      try {
        const result = createIncrementDecrementMethods(db, modelDefinition).decrement(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Creates multiple records at once
   * @param {...any[]} args - Array of records to create
   * @returns {Promise<any[]>} Created records
   */
  bulkCreate: (...args: Parameters<ReturnType<typeof createBulkCreateMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createBulkCreateMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Updates records matching conditions
   * @param {...any[]} args - Values to update and conditions
   * @returns {Promise<any>} Update result
   */
  update: (...args: Parameters<ReturnType<typeof createUpdateMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createUpdateMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Deletes records matching conditions
   * @param {...any[]} args - Delete conditions
   * @returns {Promise<number>} Number of deleted records
   */
  destroy: (...args: Parameters<ReturnType<typeof createDestroyMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createDestroyMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Truncates the table
   * @param {...any[]} args - Truncate options
   * @returns {Promise<void>}
   */
  truncate: (...args: Parameters<ReturnType<typeof createTruncateMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createTruncateMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Restores soft-deleted records
   * @param {...any[]} args - Restore conditions
   * @returns {Promise<any>} Restored records
   */
  restore: (...args: Parameters<ReturnType<typeof createRestoreMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createRestoreMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),

  /**
   * Updates or inserts a record
   * @param {...any[]} args - Values and conditions
   * @returns {Promise<any>} Updated or inserted record
   */
  upsert: (...args: Parameters<ReturnType<typeof createUpsertMethod>>) =>
    new Promise((resolve, reject) => {
      try {
        const result = createUpsertMethod(db, modelDefinition)(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }),
});
