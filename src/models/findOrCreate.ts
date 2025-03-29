// models/findOrCreate.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

/**
 * Creates a findOrCreate method for a model
 * @param db DatabaseSync instance
 * @param modelDefinition The model definition
 * @returns The findOrCreate function
 */
export function createFindOrCreateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  /**
   * Finds a record or creates it if not found
   * @param options.find The search criteria
   * @param options.create The values to create if not found (defaults to find values)
   * @returns The found or created record and a boolean indicating if it was created
   */
  return async function findOrCreate(options: {
    find: Record<string, any>;
    create?: Record<string, any>;
  }) {
    // First try to find the record
    const whereClause = Object.keys(options.find)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const values = Object.values(options.find);
    const findSql = `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT 1`;
    const foundRecord = db.prepare(findSql).get(...values);

    if (foundRecord) {
      return {
        record: foundRecord,
        created: false
      };
    }

    // If not found, create it
    const createValues = options.create || options.find;
    const columns = Object.keys(createValues);
    const placeholders = columns.map(() => '?').join(', ');
    const createSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    try {
      const result = db.prepare(createSql).run(...Object.values(createValues));
      
      // Return the created record
      return {
        record: { 
          ...createValues,
          id: result.lastInsertRowid 
        },
        created: true
      };
    } catch (error) {
      throw new Error(`Failed to create record in ${tableName}: ${
        error instanceof Error ? error.message : String(error)
      }`);
    }
  };
}