// models/update.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createUpdateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName, attributes } = modelDefinition;

  return function update(values: Record<string, any>, options: { where: Record<string, any> }) {
    const setClauses = Object.keys(values)
      .map(key => `${key} = ?`)
      .join(', ');

    const whereClauses = Object.keys(options.where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const sql = `UPDATE ${tableName} SET ${setClauses} WHERE ${whereClauses}`;
    const params = [...Object.values(values), ...Object.values(options.where)];

    return db.prepare(sql).run(...params);
  };
}