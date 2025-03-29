// models/upsert.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createUpsertMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  return function upsert(values: Record<string, any>) {
    const columns = Object.keys(values);
    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns.map(col => `${col} = excluded.${col}`).join(', ');

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT DO UPDATE SET ${updates}
    `;

    return db.prepare(sql).run(...Object.values(values));
  };
}