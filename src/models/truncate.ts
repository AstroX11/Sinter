// models/truncate.ts
import type { DatabaseSync } from 'node:sqlite';
import type { ModelDefinition } from '../Types.mjs';

export function createTruncateMethod(db: DatabaseSync, modelDefinition: ModelDefinition) {
  const { tableName } = modelDefinition;

  return function truncate() {
    return db.exec(`DELETE FROM ${tableName}`);
  };
}