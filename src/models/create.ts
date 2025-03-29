// models/create.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { validateValue } from '../generators/validation.mjs';
import { convertToSqliteValue } from './utils.js';

/**
 * Creates only the create method for a model
 * @param db DatabaseSync instance
 * @param modelDefinition The model definition
 * @returns The create function
 */
export function createModelCreateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  /**
   * Creates a new record in the database
   * @param values Field values for the new record
   * @returns The created record
   */
  return async function create(values: Record<string, any> = {}) {
    const processedValues: Record<string, any> = {};
    const validationErrors: string[] = [];

    // Process each attribute
    for (const [attrName, attrDef] of Object.entries(attributes)) {
      let value = values[attrName];

      // Handle default values
      if (value === undefined && attrDef.defaultValue !== undefined) {
        value = attrDef.defaultValue;
      }

      // Skip if value is still undefined and column allows null
      if (value === undefined) {
        if (attrDef.allowNull === false) {
          validationErrors.push(`Field '${attrName}' cannot be null`);
        }
        continue;
      }

      // Validate the value
      const validation = validateValue(value, attrDef);
      if (!validation.valid) {
        validationErrors.push(`Field '${attrName}': ${validation.errors.join(', ')}`);
        continue;
      }

      // Convert to proper SQLite type
      processedValues[attrName] = convertToSqliteValue(value, attrDef.type);
    }

    // Throw validation errors if any
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed:\n- ${validationErrors.join('\n- ')}`);
    }

    // Handle timestamps
    if (modelDefinition.options?.timestamps) {
      const now = new Date().toISOString();
      processedValues.createdAt = now;
      processedValues.updatedAt = now;
    }

    // Handle paranoid
    if (modelDefinition.options?.paranoid) {
      processedValues.deletedAt = null;
    }

    // Build and execute SQL
    const columns = Object.keys(processedValues);
    const placeholders = columns.map(() => '?').join(', ');
    const sqlValues = columns.map((col) => processedValues[col]);

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...sqlValues);

      // Return the inserted data (simple version without fetching)
      return {
        ...processedValues,
        id: result.lastInsertRowid,
      };
    } catch (error) {
      throw new Error(
        `Failed to create record in ${tableName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
}
