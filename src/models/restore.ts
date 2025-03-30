// models/restore.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createRestoreMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;

  return function restore(options: { where: Record<string, any> }) {
    if (!modelDefinition.options?.paranoid) {
      throw new Error('Restore method only available for paranoid models');
    }
    const whereClauses = Object.keys(options.where)
      .map((key) => `${key} = ?`)
      .join(' AND ');

    const sql = `UPDATE ${tableName} SET deletedAt = NULL WHERE ${whereClauses}`;
    return db.prepare(sql).run(...Object.values(options.where));
  };
}
