import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { setupTable } from './hooks.js';
import type { Schema, ModelOptions, CreationAttributes, FindAllOptions, ExtendedWhereOptions } from './types.js';

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

    static async findAll(query: FindAllOptions<typeof schema, typeof options> = {}) {
      const { timestamps = true, paranoid = false, underscored = false } = options;
      const { where, include = [], attributes, limit, offset, order, groupBy } = query;

      const selectFields = (attributes ?? Object.keys(schema).filter(k => !schema[k].isVirtual))
        .map(k => schema[k]?.field ?? (underscored ? String(k).replace(/([A-Z])/g, '_$1').toLowerCase() : k));
      if (timestamps && !attributes) selectFields.push('createdAt', 'updatedAt');
      if (paranoid && !attributes) selectFields.push('deletedAt');

      let sql = `SELECT ${selectFields.map(f => `${tableName}.${f}`).join(', ')} FROM ${tableName}`;
      const joins: string[] = [];
      const values: SQLInputValue[] = [];

      include.forEach((inc) => {
        const relatedTable = inc.model.name;
        const alias = inc.as || relatedTable;
        const ref = Object.values(schema).find(f => f.references?.model === relatedTable);
        if (!ref) throw new Error(`No reference found for ${relatedTable}`);
        const joinType = inc.required ? 'INNER JOIN' : 'LEFT JOIN';
        joins.push(`${joinType} ${relatedTable} AS ${alias} ON ${tableName}.${ref.field || ref.references?.key} = ${alias}.${ref.references?.key}`);
      });

      const whereClauses: string[] = [];
      if (paranoid) whereClauses.push(`${tableName}.deletedAt IS NULL`);

      function parseWhere(w: ExtendedWhereOptions): string {
        const clauses: string[] = [];
        for (const [key, val] of Object.entries(w)) {
          if (key === 'or' && Array.isArray(val)) {
            clauses.push(`(${val.map(parseWhere).join(' OR ')})`);
          } else if (key === 'and' && Array.isArray(val)) {
            clauses.push(`(${val.map(parseWhere).join(' AND ')})`);
          } else if (typeof val === 'object' && val !== null) {
            if ('json' in val) {
              const [path, value] = val.json!;
              clauses.push(`json_extract(${key}, '$.${path}') = ?`);
              values.push(value);
            } else if ('literal' in val) {
              clauses.push(val.literal!);
            } else {
              clauses.push(`${key} = ?`);
              values.push(val);
            }
          } else {
            clauses.push(`${key} = ?`);
            values.push(val);
          }
        }
        return clauses.join(' AND ');
      }

      if (where) whereClauses.push(parseWhere(where));
      if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;
      if (joins.length) sql += ` ${joins.join(' ')}`;
      if (groupBy) sql += ` GROUP BY ${Array.isArray(groupBy) ? groupBy.join(', ') : groupBy}`;
      if (order) sql += ` ORDER BY ${order.map(o => Array.isArray(o) ? `${o[0]} ${o[1]}` : o).join(', ')}`;
      if (limit) sql += ` LIMIT ${limit}`;
      if (offset) sql += ` OFFSET ${offset}`;

      const stmt = db.prepare(sql);
      return stmt.all(...values) as Record<string, SQLInputValue>[];
    }

    static async findByPk(id: number | string) {
      const { paranoid = false } = options;

      const primaryKey = Object.entries(schema).find(([_, field]) => field.primaryKey);
      if (!primaryKey) throw new Error('No primary key defined in schema.');

      const [pkField, pkDef] = primaryKey;
      const column = pkDef.field ?? pkField;

      let sql = `SELECT * FROM ${tableName} WHERE ${column} = ?`;
      const values = [id];

      if (paranoid) {
        sql += ` AND deletedAt IS NULL`;
      }

      const stmt = db.prepare(sql);
      return stmt.get(...values) as Record<string, SQLInputValue> | undefined;
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
