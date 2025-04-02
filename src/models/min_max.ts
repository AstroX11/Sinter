// models/incrementDecrement.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';
import { mapDataType } from '../generators/utils.js';

export function createIncrementDecrementMethods(
  db: DatabaseSync,
  modelDefinition: ModelDefinition,
) {
  const { tableName, attributes } = modelDefinition;

  return {
    /**
     * Increments a column value
     */
    increment(id: number | string | bigint, column: string, amount = 1) {
      if (
        !attributes[column] ||
        !['INTEGER', 'REAL', 'NUMERIC'].includes(mapDataType(attributes[column].type))
      ) {
        throw new Error(`Column ${column} is not a numeric type`);
      }

      const pkColumn = Object.entries(attributes).find(([_, def]) => def.primaryKey)?.[0] || 'id';

      const sql = `UPDATE ${tableName} SET ${column} = ${column} + ? WHERE ${pkColumn} = ?`;
      return db.prepare(sql).run(amount, id);
    },

    /**
     * Decrements a column value
     */
    decrement(id: number | string | bigint, column: string, amount = 1) {
      return this.increment(id, column, -amount);
    },
  };
}
