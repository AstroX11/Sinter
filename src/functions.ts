import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { setupTable } from './hooks.js';
import type { Schema, ModelOptions, CreationAttributes } from './types.js';

export function model(db: DatabaseSync, tableName: string, schema: Schema, options: ModelOptions = {}) {
  setupTable(db, tableName, schema, options);

  return class Model {
    static async create(data: CreationAttributes<typeof schema, typeof options>) {
      const { timestamps = true, paranoid = false, underscored = false } = options;
      const insertData: Record<string, SQLInputValue> = { ...data };
      const now = Date.now();

      if (timestamps) {
        insertData.createdAt = insertData.createdAt ?? now;
        insertData.updatedAt = insertData.updatedAt ?? now;
      }
      if (paranoid) insertData.deletedAt = insertData.deletedAt ?? null;

      for (const key of Object.keys(schema)) {
        const field = schema[key];
        if (field.isVirtual) continue;

        if (!(key in insertData) || insertData[key] == null) {
          const raw = field.defaultFn?.() ?? field.defaultValue ?? insertData[key];
          insertData[key] = isSQLInputValue(raw) ? raw : insertData[key];
        }

        if (key in insertData && insertData[key] != null) {
          if (field.transform) insertData[key] = field.transform(insertData[key]) as string;
          if (field.set) {
            field.set(insertData[key], { value: (v) => (insertData[key] = v as SQLInputValue) });
          }

          if (field.validate) {
            for (const [rule, validator] of Object.entries(field.validate)) {
              if (!(await validator(insertData[key]))) throw new Error(`Validation failed for ${key}: ${rule}`);
            }
          }
        }
      }

      const keys = Object.keys(schema).filter((key) => !schema[key].isVirtual && !(schema[key].autoIncrement && !insertData[key]) && !(schema[key].generatedAs && !insertData[key]));
      const mappedKeys = keys.map((key) => schema[key].field ?? (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key));
      if (timestamps) mappedKeys.push('createdAt', 'updatedAt');
      if (paranoid) mappedKeys.push('deletedAt');

      const placeholders = mappedKeys.map(() => '?').join(', ');
      const values = mappedKeys.map((key) => insertData[key.replace(/_[a-z]/g, (m) => m[1].toUpperCase())]) as SQLInputValue[];

      const stmt = db.prepare(`INSERT INTO ${tableName} (${mappedKeys.join(', ')}) VALUES (${placeholders}) RETURNING *`);
      return stmt.get(...values) as Record<string, SQLInputValue>;
    }
  };
}

function isSQLInputValue(value: unknown): value is import('node:sqlite').SQLInputValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value === null ||
    value instanceof Uint8Array
  );
}
