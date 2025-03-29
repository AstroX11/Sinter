// models/findByPk.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

/**
 * Creates a findByPk method for a model
 * @param db DatabaseSync instance
 * @param modelDefinition The model definition
 * @returns The findByPk function
 */
export function createFindByPkMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  // Find the primary key column name
  const pkColumn = Object.entries(attributes).find(
    ([_, def]) => def.primaryKey
  )?.[0] || 'id';

  /**
   * Finds a record by its primary key
   * @param id The primary key value
   * @returns The found record or undefined if not found
   */
  return function findByPk(id: number | string | bigint) {
    const sql = `SELECT * FROM ${tableName} WHERE ${pkColumn} = ? LIMIT 1`;
    return db.prepare(sql).get(id);
  };
}