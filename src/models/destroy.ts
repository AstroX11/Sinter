// models/destroy.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createDestroyMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;

  return function destroy(options: { where: Record<string, any> }) {
    const whereClauses = Object.keys(options.where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const sql = `DELETE FROM ${tableName} WHERE ${whereClauses}`;
    return db.prepare(sql).run(...Object.values(options.where));
  };
}