import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { setupTable } from './hooks.js';
import { type Schema, type ModelOptions, type CreationAttributes, type FindAllOptions, type ExtendedWhereOptions, DataType } from './types.js';

function isSQLInputValue(value: unknown): value is SQLInputValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value === null ||
    value instanceof Uint8Array
  );
}

function parseWhere(w: ExtendedWhereOptions, values: SQLInputValue[]): string {
  const clauses: string[] = [];
  for (const [key, val] of Object.entries(w)) {
    if (key === 'or' && Array.isArray(val)) {
      clauses.push(`(${val.map(v => parseWhere(v, values)).join(' OR ')})`);
    } else if (key === 'and' && Array.isArray(val)) {
      clauses.push(`(${val.map(v => parseWhere(v, values)).join(' AND ')})`);
    } else if (typeof val === 'object' && val !== null) {
      if ('json' in val) {
        const [path, value] = val.json!;
        clauses.push(`json_extract(${key}, '$.${path}') = ?`);
        values.push(value);
      } else if ('literal' in val) {
        clauses.push(val.literal!);
      } else if ('__col__' in val) {
        clauses.push(`${key} = ${val.__col__}`);
      } else if ('__fn__' in val) {
        const { __fn__, args } = val as { __fn__: string; args: any[] };
        const formattedArgs = args.map((arg: any) => (typeof arg === 'string' ? `'${arg}'` : arg));
        clauses.push(`${key} = ${__fn__}(${formattedArgs.join(', ')})`);
      } else if (val[Op.lt]) {
        clauses.push(`${key} < ?`);
        values.push(val[Op.lt]);
      } else if (val[Op.lte]) {
        clauses.push(`${key} <= ?`);
        values.push(val[Op.lte]);
      } else if (val[Op.gt]) {
        clauses.push(`${key} > ?`);
        values.push(val[Op.gt]);
      } else if (val[Op.gte]) {
        clauses.push(`${key} >= ?`);
        values.push(val[Op.gte]);
      } else if (val[Op.ne]) {
        clauses.push(`${key} != ?`);
        values.push(val[Op.ne]);
      } else if (val[Op.eq]) {
        clauses.push(`${key} = ?`);
        values.push(val[Op.eq]);
      } else if (val[Op.in] && Array.isArray(val[Op.in])) {
        clauses.push(`${key} IN (${val[Op.in].map(() => '?').join(', ')})`);
        values.push(...val[Op.in]);
      } else if (val[Op.notIn] && Array.isArray(val[Op.notIn])) {
        clauses.push(`${key} NOT IN (${val[Op.notIn].map(() => '?').join(', ')})`);
        values.push(...val[Op.notIn]);
      } else if (val[Op.like]) {
        clauses.push(`${key} LIKE ?`);
        values.push(val[Op.like]);
      } else if (val[Op.notLike]) {
        clauses.push(`${key} NOT LIKE ?`);
        values.push(val[Op.notLike]);
      } else if (val[Op.is] !== undefined) {
        clauses.push(`${key} IS ${val[Op.is] === null ? 'NULL' : 'NOT NULL'}`);
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

export function model(db: DatabaseSync, tableName: string, schema: Schema, options: ModelOptions = {}) {
  setupTable(db, tableName, schema, options);

  return class Model {
    static async create(data: CreationAttributes<typeof schema, typeof options>): Promise<Record<string, SQLInputValue>> {
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

        if (key in insertData && insertData[key] != null && !(typeof insertData[key] === 'object' && insertData[key] && '__fn__' in (insertData[key] as any))) {
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
      const values = mappedKeys.map((key) => {
        const value = insertData[key.replace(/_[a-z]/g, (m) => m[1].toUpperCase())];
        if (typeof value === 'object' && value !== null && '__fn__' in value) {
          const { __fn__, args = [] } = value as { __fn__: string; args?: any[] };
          const formattedArgs = args.map((arg: any) => (typeof arg === 'string' ? `'${arg}'` : arg));
          return `${__fn__}(${formattedArgs.join(', ')})`;
        }
        return value;
      }) as SQLInputValue[];

      const stmt = db.prepare(`INSERT INTO ${tableName} (${mappedKeys.join(', ')}) VALUES (${placeholders}) RETURNING *`);
      return stmt.get(...values) as Record<string, SQLInputValue>;
    }

    static async findAll(query: FindAllOptions<typeof schema, typeof options> = {}): Promise<Record<string, SQLInputValue>[]> {
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

      if (where) whereClauses.push(parseWhere(where, values));
      if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;
      if (joins.length) sql += ` ${joins.join(' ')}`;
      if (groupBy) sql += ` GROUP BY ${Array.isArray(groupBy) ? groupBy.join(', ') : groupBy}`;
      if (order) sql += ` ORDER BY ${order.map(o => Array.isArray(o) ? `${o[0]} ${o[1]}` : o).join(', ')}`;
      if (limit) sql += ` LIMIT ${limit}`;
      if (offset) sql += ` OFFSET ${offset}`;

      const stmt = db.prepare(sql);
      return stmt.all(...values) as Record<string, SQLInputValue>[];
    }

    static async findByPk(id: number | string): Promise<Record<string, SQLInputValue> | undefined> {
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

    static async findOne<S extends Schema, O extends ModelOptions>(
      options: FindAllOptions<S, O> = {} as FindAllOptions<S, O>
    ): Promise<Record<string, SQLInputValue> | null> {
      const results = await Model.findAll({ ...options, limit: 1 } as FindAllOptions<typeof schema, ModelOptions>);
      return results?.[0] ?? null;
    }

    static async update(
      values: Partial<Record<string, SQLInputValue>>,
      opts: { where: ExtendedWhereOptions }
    ): Promise<unknown> {
      const { timestamps = true, paranoid = false, underscored = false } = options;

      const updates: string[] = [];
      const updateValues: SQLInputValue[] = [];

      for (const [key, value] of Object.entries(values)) {
        const fieldDef = schema[key];
        if (!fieldDef || fieldDef.isVirtual || fieldDef.readOnly) continue;

        let val: SQLInputValue = value as SQLInputValue;
        let usePlaceholder = true;

        if (typeof value === 'object' && value !== null) {
          if ('__fn__' in value) {
            const { __fn__, args = [] } = value as { __fn__: string; args?: any[] };
            const formattedArgs = args.map((arg: any) => (typeof arg === 'string' ? `'${arg}'` : arg));
            const fnStr = `${__fn__}(${formattedArgs.join(', ')})`;
            const col = fieldDef.field ?? (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key);
            updates.push(`${col} = ${fnStr}`);
            usePlaceholder = false;
          }
        }

        if (usePlaceholder) {
          if (val === null || val === undefined) {
            val = '';
          }

          if (fieldDef.transform) {
            val = fieldDef.transform(val) as SQLInputValue;
          }

          if (fieldDef.set) {
            fieldDef.set(val, {
              value: (v) => {
                val = v as SQLInputValue;
              },
            });
          }

          if (fieldDef.validate) {
            for (const [rule, validator] of Object.entries(fieldDef.validate)) {
              if (!(await validator(val))) {
                throw new Error(`Validation failed for ${key}: ${rule}`);
              }
            }
          }

          const col = fieldDef.field ?? (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key);
          updates.push(`${col} = ?`);
          updateValues.push(val as SQLInputValue);
        }
      }

      if (timestamps) {
        updates.push(`updatedAt = ?`);
        updateValues.push(Date.now());
      }

      if (!updates.length) throw new Error('No valid fields provided for update');

      const whereClauseParts: string[] = [];
      const whereValues: SQLInputValue[] = [];

      if (paranoid) {
        whereClauseParts.push(`${tableName}.deletedAt IS NULL`);
      }

      const whereStr = parseWhere(opts.where, whereValues);
      if (whereStr) whereClauseParts.push(whereStr);

      const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${whereClauseParts.join(' AND ')}`;
      const stmt = db.prepare(sql);
      return stmt.run(...updateValues, ...whereValues);
    }

    static async upsert(
      values: CreationAttributes<typeof schema, typeof options>,
      opts: { where?: ExtendedWhereOptions } = {}
    ): Promise<Record<string, SQLInputValue> | null> {
      const { timestamps = true, paranoid = false } = options;
      const { where = {} } = opts;

      const processedValues: Record<string, SQLInputValue> = { ...values };
      const now = Date.now();

      if (timestamps) {
        processedValues.createdAt = processedValues.createdAt ?? now;
        processedValues.updatedAt = processedValues.updatedAt ?? now;
      }
      if (paranoid) processedValues.deletedAt = processedValues.deletedAt ?? null;

      for (const key of Object.keys(schema)) {
        const field = schema[key];
        if (field.isVirtual) {
          delete processedValues[key];
          continue;
        }

        if (!(key in processedValues) || processedValues[key] == null) {
          const raw = field.defaultFn?.() ?? field.defaultValue;
          processedValues[key] = isSQLInputValue(raw) ? raw : processedValues[key];
        }

        if (key in processedValues && processedValues[key] != null && !(typeof processedValues[key] === 'object' && '__fn__' in (processedValues[key] as any))) {
          if (field.transform) processedValues[key] = field.transform(processedValues[key]) as SQLInputValue;
          if (field.set) {
            field.set(processedValues[key], { value: (v) => (processedValues[key] = v as SQLInputValue) });
          }

          if (field.validate) {
            for (const [rule, validator] of Object.entries(field.validate)) {
              if (!(await validator(processedValues[key]))) throw new Error(`Validation failed for ${key}: ${rule}`);
            }
          }
        }
      }

      let lookupWhere = { ...where };
      if (Object.keys(lookupWhere).length === 0) {
        const primaryKey = Object.entries(schema).find(([_, field]) => field.primaryKey);
        const uniqueKey = Object.entries(schema).find(([_, field]) => field.unique);
        if (primaryKey && values[primaryKey[0]] !== undefined) {
          lookupWhere[primaryKey[0]] = values[primaryKey[0]];
        } else if (uniqueKey && values[uniqueKey[0]] !== undefined) {
          lookupWhere[uniqueKey[0]] = values[uniqueKey[0]];
        } else {
          throw new Error('Upsert requires a where clause or a value for primary/unique key');
        }
      }

      const existingRecord = await this.findOne({ where: lookupWhere });

      if (!existingRecord) {
        return this.create(processedValues as CreationAttributes<typeof schema, typeof options>);
      }

      const updateValues = { ...processedValues };
      if (timestamps) {
        delete updateValues.createdAt;
      }

      const primaryKey = Object.entries(schema).find(([_, field]) => field.primaryKey);
      if (primaryKey) {
        delete updateValues[primaryKey[0]];
      }

      if (Object.keys(updateValues).length === 0) {
        return existingRecord;
      }

      await this.update(updateValues, { where: lookupWhere });
      return this.findOne({ where: lookupWhere });
    }

    static async destroy(Destoryoptions: { where: ExtendedWhereOptions; force?: boolean }): Promise<number | unknown> {
      const { paranoid = false } = options;
      const { where, force = false } = Destoryoptions;

      if (paranoid && !force) {
        // Soft delete
        return this.update({ deletedAt: Date.now() }, { where });
      }

      // Hard delete
      const whereClauses: string[] = [];
      const values: SQLInputValue[] = [];

      const whereStr = parseWhere(where, values);
      if (whereStr) whereClauses.push(whereStr);

      if (paranoid) {
        whereClauses.push('deletedAt IS NOT NULL');
      }

      const sql = `DELETE FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...values);
      return result.changes as number;
    }

    static async truncate({ cascade = false }: { cascade?: boolean } = {}): Promise<void> {
      if (cascade) {
        // Note: SQLite doesn't support CASCADE in TRUNCATE, so we use DELETE
        db.prepare(`DELETE FROM ${tableName}`).run();
        // Reset autoincrement counters
        db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(tableName);
      } else {
        db.prepare(`DELETE FROM ${tableName}`).run();
      }
    }

    // Math/Aggregation methods
    static async count(countOptions: { where?: ExtendedWhereOptions } = {}): Promise<number> {
      const { paranoid = false } = options;
      const { where } = countOptions;

      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const whereClauses: string[] = [];
      const values: SQLInputValue[] = [];

      if (paranoid) {
        whereClauses.push('deletedAt IS NULL');
      }

      if (where) {
        whereClauses.push(parseWhere(where, values));
      }

      if (whereClauses.length) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      const stmt = db.prepare(sql);
      const result = stmt.get(...values) as { count: number };
      return result.count;
    }

    static async sum(field: string, options: { where?: ExtendedWhereOptions } = {}): Promise<number> {
      return this._aggregate('SUM', field, options);
    }

    static async min(field: string, options: { where?: ExtendedWhereOptions } = {}): Promise<number> {
      return this._aggregate('MIN', field, options);
    }

    static async max(field: string, options: { where?: ExtendedWhereOptions } = {}): Promise<number> {
      return this._aggregate('MAX', field, options);
    }

    static async average(field: string, options: { where?: ExtendedWhereOptions } = {}): Promise<number> {
      return this._aggregate('AVG', field, options);
    }

    static async _aggregate(
      fnName: string,
      field: string,
      Opts: { where?: ExtendedWhereOptions } = {}
    ): Promise<number> {
      const { paranoid = false } = options;
      const { where } = Opts;

      const fieldDef = schema[field];
      if (!fieldDef) throw new Error(`Field ${field} not found in schema`);

      const column = fieldDef.field ?? field;
      let sql = `SELECT ${fnName}(${column}) as value FROM ${tableName}`;
      const whereClauses: string[] = [];
      const values: SQLInputValue[] = [];

      if (paranoid) {
        whereClauses.push('deletedAt IS NULL');
      }

      if (where) {
        whereClauses.push(parseWhere(where, values));
      }

      if (whereClauses.length) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      const stmt = db.prepare(sql);
      const result = stmt.get(...values) as { value: number | null };
      return result.value ?? 0;
    }

    // Bulk operations
    static async bulkCreate(
      records: CreationAttributes<typeof schema, typeof options>[],
      bulkCreateOpts: { ignoreDuplicates?: boolean } = {}
    ): Promise<Record<string, SQLInputValue>[]> {
      const { timestamps = true, paranoid = false, underscored = false } = options;
      const { ignoreDuplicates = false } = bulkCreateOpts;

      if (!records.length) return [];

      const now = Date.now();
      const insertedRecords: Record<string, SQLInputValue>[] = [];

      // Prepare a single insert statement for all records
      const firstRecord = records[0];
      const keys = Object.keys(schema).filter(
        (key) =>
          !schema[key].isVirtual &&
          !(schema[key].autoIncrement && !firstRecord[key]) &&
          !(schema[key].generatedAs && !firstRecord[key])
      );

      const mappedKeys = keys.map((key) =>
        schema[key].field ?? (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key)
      );

      if (timestamps) {
        mappedKeys.push('createdAt', 'updatedAt');
      }
      if (paranoid) {
        mappedKeys.push('deletedAt');
      }

      const placeholders = records.map(() => `(${mappedKeys.map(() => '?').join(', ')})`).join(', ');
      const values: SQLInputValue[] = [];

      for (const record of records) {
        const insertData: Record<string, SQLInputValue> = { ...record };

        if (timestamps) {
          insertData.createdAt = insertData.createdAt ?? now;
          insertData.updatedAt = insertData.updatedAt ?? now;
        }
        if (paranoid) {
          insertData.deletedAt = insertData.deletedAt ?? null;
        }

        for (const key of keys) {
          const field = schema[key];
          if (!(key in insertData) || insertData[key] == null) {
            const raw = field.defaultFn?.() ?? field.defaultValue;
            insertData[key] = isSQLInputValue(raw) ? raw : null;
          }

          if (key in insertData && insertData[key] != null) {
            if (field.transform) {
              insertData[key] = field.transform(insertData[key]) as SQLInputValue;
            }
            if (field.set) {
              field.set(insertData[key], {
                value: (v) => (insertData[key] = v as SQLInputValue),
              });
            }
          }
        }

        values.push(
          ...mappedKeys.map((key) => {
            const originalKey = key.replace(/_[a-z]/g, (m) => m[1].toUpperCase());
            return insertData[originalKey];
          })
        );
      }

      const onConflict = ignoreDuplicates ? 'ON CONFLICT DO NOTHING' : '';
      const sql = `INSERT ${onConflict} INTO ${tableName} (${mappedKeys.join(
        ', '
      )}) VALUES ${placeholders} RETURNING *`;

      try {
        const stmt = db.prepare(sql);
        const result = stmt.all(...values) as Record<string, SQLInputValue>[];
        insertedRecords.push(...result);
      } catch (error) {
        if (ignoreDuplicates && error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          // Some records may have been inserted, we just ignore the error
        } else {
          throw error;
        }
      }

      return insertedRecords;
    }

    static async increment(
      fields: Record<string, number>,
      Opts: { where: ExtendedWhereOptions; by?: number }
    ): Promise<void> {
      const { where, by = 1 } = Opts;
      const updates: string[] = [];
      const values: SQLInputValue[] = [];

      for (const [field, amount] of Object.entries(fields)) {
        const fieldDef = schema[field];
        if (!fieldDef) throw new Error(`Field ${field} not found in schema`);
        if (!fieldDef.type || ![DataType.INTEGER, DataType.BIGINT, DataType.FLOAT].includes(fieldDef.type)) {
          throw new Error(`Field ${field} is not numeric and cannot be incremented`);
        }

        const column = fieldDef.field ?? field;
        updates.push(`${column} = ${column} + ?`);
        values.push(amount * by);
      }

      const whereClauses: string[] = [];
      const whereStr = parseWhere(where, values);
      if (whereStr) whereClauses.push(whereStr);

      if (options.paranoid) {
        whereClauses.push('deletedAt IS NULL');
      }

      const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
      db.prepare(sql).run(...values);
    }

    static async decrement(
      fields: Record<string, number>,
      options: { where: ExtendedWhereOptions; by?: number }
    ): Promise<void> {
      await this.increment(
        Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, -v])),
        options
      );
    }

    // Other utility methods
    static async findOrCreate(opts: {
      where: ExtendedWhereOptions;
      extras: CreationAttributes<typeof schema, typeof options>;
    }): Promise<[Record<string, SQLInputValue>, boolean]> {
      const existing = await this.findOne({ where: opts.where });
      if (existing) {
        return [existing, false];
      }

      const created = await this.create({
        ...opts.extras,
        ...opts.where,
      });
      return [created, true];
    }

    static async restore(restoreOptions: { where: ExtendedWhereOptions }): Promise<number | unknown> {
      if (!options.paranoid) {
        throw new Error('Cannot restore records when paranoid mode is disabled');
      }

      return this.update({ deletedAt: null }, { where: restoreOptions.where });
    }
  }
}

export const Op = {
  lt: Symbol('lt'),
  lte: Symbol('lte'),
  gt: Symbol('gt'),
  gte: Symbol('gte'),
  ne: Symbol('ne'),
  eq: Symbol('eq'),
  in: Symbol('in'),
  notIn: Symbol('notIn'),
  like: Symbol('like'),
  notLike: Symbol('notLike'),
  is: Symbol('is'),
};

export function col(name: string) {
  return { __col__: name };
}

export function fn(name: string, ...args: any[]) {
  return { __fn__: name, args };
}