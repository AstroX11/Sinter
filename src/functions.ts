import { DatabaseSync } from 'node:sqlite';
import { setupTable } from './hooks.js';
import {
 DataType,
 type Schema,
 type ModelOptions,
 type CreationAttributes,
 type FindAllOptions,
 type ExtendedWhereOptions,
 type ORMInputValue,
 type FieldDefinition,
} from './types.js';
import {
 parseWhere,
 validateField,
 transformField,
 mapKeys,
 processTimestampsAndParanoid,
 handleSQLFunction,
 processRecordData,
 toSQLInputValue,
 normalizeToOrmInput,
 Op,
} from './tools.js';

export function model(
 db: DatabaseSync,
 tableName: string,
 schema: Schema,
 options: ModelOptions = {},
) {
 setupTable(db, tableName, schema, options);

 return class Model {
  static async query(query: string): Promise<unknown> {
   return Promise.resolve(db.exec(query));
  }

  static async create(
   data: CreationAttributes<typeof schema, typeof options>,
  ): Promise<Record<string, ORMInputValue>> {
   const insertData: Record<string, ORMInputValue> = { ...data };

   processTimestampsAndParanoid(insertData, options);

   for (const [field, definition] of Object.entries(schema)) {
    const def = definition as FieldDefinition;

    if (def.readOnly || def.isVirtual || def.generatedAs) {
     delete insertData[field];
     continue;
    }

    if (insertData[field] === undefined) {
     if (typeof def.defaultFn === 'function') {
      const defaultValue = def.defaultFn();
      insertData[field] = normalizeToOrmInput(defaultValue);
     } else if (def.defaultValue !== undefined) {
      insertData[field] = normalizeToOrmInput(def.defaultValue);
     }
    }

    if (insertData[field] !== undefined) {
     if (typeof def.set === 'function') {
      let finalValue: unknown = insertData[field];
      def.set(finalValue, { value: (v: unknown) => (finalValue = v) });
      insertData[field] = normalizeToOrmInput(finalValue);
     }

     if (typeof def.transform === 'function') {
      insertData[field] = normalizeToOrmInput(def.transform(insertData[field]));
     }

     if (def.validate) {
      const validations = Object.entries(def.validate).map(
       async ([validatorName, validator]) => {
        const isValid = await validator(insertData[field]);
        if (!isValid) {
         throw new Error(
          `Validation failed for field "${field}": ${validatorName}`,
         );
        }
       },
      );
      await Promise.all(validations);
     }
    }

    if (
     insertData[field] === undefined &&
     !def.allowNull &&
     !def.autoIncrement
    ) {
     throw new Error(
      `Field "${field}" cannot be null and has no default value`,
     );
    }
   }

   processRecordData(schema, insertData, options);

   for (const [field, definition] of Object.entries(schema)) {
    const def = definition as FieldDefinition;

    const operatorKeys = Object.keys(Op);

    if (
     insertData[field] &&
     typeof insertData[field] === 'object' &&
     !Array.isArray(insertData[field])
    ) {
     operatorKeys.forEach((op) => {
      if (
       insertData[field] &&
       typeof insertData[field] === 'object' &&
       op in insertData[field]
      ) {
       const operator = (insertData[field] as Record<string, unknown>)[op];
       insertData[field] = {
        operator,
        value: (insertData[field] as Record<string, unknown>)[op],
       };
      }
     });
    }

    if (def.hidden && !insertData[field] && !def.allowNull) {
     insertData[field] = data[field];
    }

    if ((def.hidden || def.transient || def.writeOnly) && def.allowNull) {
     delete insertData[field];
    }
   }

   if (options.validate) {
    const modelValidations = Object.entries(options.validate).map(
     async ([validatorName, validator]) => {
      const isValid = await validator(insertData);
      if (!isValid) {
       throw new Error(`Model validation failed: ${validatorName}`);
      }
     },
    );
    await Promise.all(modelValidations);
   }

   if (typeof options.hooks?.beforeCreate === 'function') {
    await options.hooks.beforeCreate(insertData);
   }

   const keys = Object.keys(insertData);
   const placeholders = keys.map(() => '?').join(', ');
   const values = keys
    .map((key) =>
     handleSQLFunction(insertData[key], key, options.underscored ?? false),
    )
    .map(toSQLInputValue);

   const sql = `INSERT INTO ${tableName} (${keys.join(
    ', ',
   )}) VALUES (${placeholders}) RETURNING *`;

   const stmt = db.prepare(sql);
   const result = stmt.get(...values) as Record<string, ORMInputValue>;

   const finalResult: Record<string, ORMInputValue> = { ...result };

   for (const [field, definition] of Object.entries(schema)) {
    const def = definition as FieldDefinition;

    if (typeof def.get === 'function' && finalResult[field] !== undefined) {
     const getterValue = def.get.call(finalResult);
     finalResult[field] = normalizeToOrmInput(getterValue);
    }

    if (def.hidden || def.hiddenFromSelect || def.writeOnly) {
     delete finalResult[field];
    }
   }

   if (typeof options.hooks?.afterCreate === 'function') {
    await options.hooks.afterCreate(finalResult);
   }

   return JSON.parse(JSON.stringify(finalResult));
  }

  static async findAll(
   query: FindAllOptions<typeof schema, typeof options> = {},
  ): Promise<Record<string, ORMInputValue>[]> {
   const { timestamps = true, paranoid = false, underscored = false } = options;
   const {
    where,
    include = [],
    attributes,
    limit,
    offset,
    order,
    groupBy,
   } = query;

   const selectFields = (
    attributes ?? Object.keys(schema).filter((k) => !schema[k]!.isVirtual)
   ).map(
    (k) =>
     schema[k]?.field ??
     (underscored
      ? String(k)
         .replace(/([A-Z])/g, '_$1')
         .toLowerCase()
      : k),
   );
   if (timestamps && !attributes) selectFields.push('createdAt', 'updatedAt');
   if (paranoid && !attributes) selectFields.push('deletedAt');

   let sql = `SELECT ${selectFields
    .map((f) => `${tableName}.${f}`)
    .join(', ')} FROM ${tableName}`;
   const joins: string[] = [];
   const values: ORMInputValue[] = [];

   include.forEach((inc) => {
    const relatedTable = inc.model.name;
    const alias = inc.as || relatedTable;
    const ref = Object.values(schema).find(
     (f) => f.references?.model === relatedTable,
    );
    if (!ref) throw new Error(`No reference found for ${relatedTable}`);
    const joinType = inc.required ? 'INNER JOIN' : 'LEFT JOIN';
    joins.push(
     `${joinType} ${relatedTable} AS ${alias} ON ${tableName}.${
      ref.field || ref.references?.key
     } = ${alias}.${ref.references?.key}`,
    );
   });

   const whereClauses: string[] = [];
   if (paranoid) whereClauses.push(`${tableName}.deletedAt IS NULL`);

   if (where) whereClauses.push(parseWhere(where, values));
   if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;
   if (joins.length) sql += ` ${joins.join(' ')}`;
   if (groupBy)
    sql += ` GROUP BY ${Array.isArray(groupBy) ? groupBy.join(', ') : groupBy}`;
   if (order)
    sql += ` ORDER BY ${order
     .map((o) => (Array.isArray(o) ? `${o[0]} ${o[1]}` : o))
     .join(', ')}`;
   if (limit) sql += ` LIMIT ${limit}`;
   if (offset) sql += ` OFFSET ${offset}`;

   const stmt = db.prepare(sql);
   return JSON.parse(
    JSON.stringify(stmt.all(...values.map(toSQLInputValue))),
   ) as Record<string, ORMInputValue>[];
  }

  static async findByPk(
   id: number | string,
  ): Promise<Record<string, ORMInputValue> | undefined> {
   const { paranoid = false } = options;
   const primaryKey = Object.entries(schema).find(
    ([_, field]) => field.primaryKey,
   );
   if (!primaryKey) throw new Error('No primary key defined in schema.');

   const [pkField, pkDef] = primaryKey;
   const column = pkDef.field ?? pkField;
   let sql = `SELECT * FROM ${tableName} WHERE ${column} = ?`;
   const values = [id];

   if (paranoid) sql += ` AND deletedAt IS NULL`;

   const stmt = db.prepare(sql);
   return stmt.get(...values.map(toSQLInputValue))
    ? JSON.parse(JSON.stringify(stmt.get(...values.map(toSQLInputValue))))
    : (undefined as Record<string, ORMInputValue> | undefined);
  }

  static async findOne(
   opts: FindAllOptions<typeof schema, typeof options> = {},
  ): Promise<Record<string, ORMInputValue> | null> {
   const results = await Model.findAll({ ...opts, limit: 1 });
   return results?.[0] ? JSON.parse(JSON.stringify(results[0])) : null;
  }

  static async update(
   values: Partial<Record<string, ORMInputValue>>,
   opts: { where: ExtendedWhereOptions },
  ): Promise<{ changes: number | bigint }> {
   const { timestamps = true, paranoid = false, underscored = false } = options;
   const updates: string[] = [];
   const updateValues: ORMInputValue[] = [];

   for (const [key, value] of Object.entries(values)) {
    const fieldDef = schema[key];
    if (!fieldDef || fieldDef.isVirtual || fieldDef.readOnly) continue;

    if (fieldDef.type === DataType.JSON) {
     const col =
      fieldDef.field ??
      (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key);
     updates.push(`${col} = ?`);
     updateValues.push(JSON.stringify(value));
     continue;
    }

    const fnResult = handleSQLFunction(value!, key, underscored);
    if (typeof fnResult === 'string') {
     const col =
      fieldDef.field ??
      (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key);
     updates.push(`${col} = ${fnResult}`);
    } else {
     let val: ORMInputValue = value ?? '';
     val = transformField(val, fieldDef, (v: unknown) => {
      val = v as ORMInputValue;
     });
     validateField(val, fieldDef, key);

     const col =
      fieldDef.field ??
      (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key);
     updates.push(`${col} = ?`);
     updateValues.push(val);
    }
   }

   if (timestamps && !('updatedAt' in values)) {
    updates.push(`updatedAt = ?`);
    updateValues.push(Date.now());
   }

   if (!updates.length) throw new Error('No valid fields provided for update');

   const whereClauseParts: string[] = [];
   const whereValues: ORMInputValue[] = [];

   if (paranoid) whereClauseParts.push(`${tableName}.deletedAt IS NULL`);

   const whereStr = parseWhere(opts.where, whereValues);
   if (whereStr) whereClauseParts.push(whereStr);

   const sql = `UPDATE ${tableName} SET ${updates.join(
    ', ',
   )} WHERE ${whereClauseParts.join(' AND ')}`;

   const stmt = db.prepare(sql);

   const result = stmt.run(
    ...updateValues.map(toSQLInputValue),
    ...whereValues.map(toSQLInputValue),
   );

   return { changes: result.changes };
  }

  static async upsert(
   values: CreationAttributes<typeof schema, typeof options>,
   opts: { where?: ExtendedWhereOptions } = {},
  ): Promise<Record<string, ORMInputValue> | null> {
   const processedValues: Record<string, ORMInputValue> = { ...values };
   processTimestampsAndParanoid(processedValues, options);
   processRecordData(schema, processedValues, options);

   let lookupWhere = { ...(opts.where ?? {}) };

   if (Object.keys(lookupWhere).length === 0) {
    const primaryKey = Object.entries(schema).find(
     ([_, field]) => field.primaryKey,
    );
    const uniqueKey = Object.entries(schema).find(([_, field]) => field.unique);

    if (primaryKey && values[primaryKey[0]] !== undefined) {
     lookupWhere[primaryKey[0]] = values[primaryKey[0]];
    } else if (uniqueKey && values[uniqueKey[0]] !== undefined) {
     lookupWhere[uniqueKey[0]] = values[uniqueKey[0]];
    } else {
     throw new Error(
      'Upsert requires a where clause or a value for primary/unique key',
     );
    }
   }

   const existingRecord = await this.findOne({ where: lookupWhere });

   if (existingRecord) {
    const updateValues = { ...processedValues };

    if (options.timestamps) delete updateValues.createdAt;

    const primaryKey = Object.entries(schema).find(
     ([_, field]) => field.primaryKey,
    );
    if (primaryKey) delete updateValues[primaryKey[0]];

    if (Object.keys(updateValues).length > 0) {
     await this.update(updateValues, { where: lookupWhere });
    }

    return this.findOne({ where: lookupWhere });
   } else {
    try {
     return await this.create(
      processedValues as CreationAttributes<typeof schema, typeof options>,
     );
    } catch {
     await this.update(processedValues, { where: lookupWhere });
     return this.findOne({ where: lookupWhere });
    }
   }
  }

  static async destroy(destroyOptions: {
   where: ExtendedWhereOptions;
   force?: boolean;
  }): Promise<number | unknown> {
   const { paranoid = false } = options;
   const { where, force = false } = destroyOptions;

   if (paranoid && !force)
    return this.update({ deletedAt: Date.now() }, { where });

   const whereClauses: string[] = [];
   const values: ORMInputValue[] = [];

   const whereStr = parseWhere(where, values);
   if (whereStr) whereClauses.push(whereStr);

   if (paranoid) whereClauses.push('deletedAt IS NOT NULL');

   const sql = `DELETE FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`;
   const stmt = db.prepare(sql);
   const result = stmt.run(...values.map(toSQLInputValue));
   return result.changes as number;
  }

  static async truncate({
   cascade = false,
  }: { cascade?: boolean } = {}): Promise<void> {
   if (cascade) {
    db.prepare(`DELETE FROM ${tableName}`).run();
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(tableName);
   } else {
    db.prepare(`DELETE FROM ${tableName}`).run();
   }
  }

  static async count(
   countOptions: { where?: ExtendedWhereOptions } = {},
  ): Promise<number> {
   const { paranoid = false } = options;
   const { where } = countOptions;

   let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
   const whereClauses: string[] = [];
   const values: ORMInputValue[] = [];

   if (paranoid) whereClauses.push('deletedAt IS NULL');
   if (where) whereClauses.push(parseWhere(where, values));

   if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;

   const stmt = db.prepare(sql);
   const result = stmt.get(...values.map(toSQLInputValue)) as { count: number };
   return result.count;
  }

  static async sum(
   field: string,
   options: { where?: ExtendedWhereOptions } = {},
  ): Promise<number> {
   return this._aggregate('SUM', field, options);
  }

  static async min(
   field: string,
   options: { where?: ExtendedWhereOptions } = {},
  ): Promise<number> {
   return this._aggregate('MIN', field, options);
  }

  static async max(
   field: string,
   options: { where?: ExtendedWhereOptions } = {},
  ): Promise<number> {
   return this._aggregate('MAX', field, options);
  }

  static async average(
   field: string,
   options: { where?: ExtendedWhereOptions } = {},
  ): Promise<number> {
   return this._aggregate('AVG', field, options);
  }

  static async _aggregate(
   fnName: string,
   field: string,
   opts: { where?: ExtendedWhereOptions } = {},
  ): Promise<number> {
   const { paranoid = false } = options;
   const { where } = opts;

   const fieldDef = schema[field];
   if (!fieldDef) throw new Error(`Field ${field} not found in schema`);

   const column = fieldDef.field ?? field;
   let sql = `SELECT ${fnName}(${column}) as value FROM ${tableName}`;
   const whereClauses: string[] = [];
   const values: ORMInputValue[] = [];

   if (paranoid) whereClauses.push('deletedAt IS NULL');
   if (where) whereClauses.push(parseWhere(where, values));

   if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;

   const stmt = db.prepare(sql);
   const result = stmt.get(...values.map(toSQLInputValue)) as {
    value: number | null;
   };
   return result.value ?? 0;
  }

  static async bulkCreate(
   records: CreationAttributes<typeof schema, typeof options>[],
   bulkCreateOpts: { ignoreDuplicates?: boolean } = {},
  ): Promise<Record<string, ORMInputValue>[]> {
   const { timestamps = true, paranoid = false, underscored = false } = options;
   const { ignoreDuplicates = false } = bulkCreateOpts;

   if (!records.length) return [];

   let dedupedRecords = records;

   if (ignoreDuplicates) {
    const seen = new Set<string>();
    dedupedRecords = records.filter((record) => {
     const key = JSON.stringify(record);
     if (seen.has(key)) return false;
     seen.add(key);
     return true;
    });
   } else if (Object.entries(schema).some(([_, def]) => def.unique)) {
    const seen = new Set<string>();
    dedupedRecords = records.filter((record) => {
     const key = JSON.stringify(
      Object.keys(schema)
       .filter((key) => schema[key]?.unique)
       .map((key) => record[key])
       .join('|'),
     );
     if (seen.has(key)) return false;
     seen.add(key);
     return true;
    });
   }

   if (!dedupedRecords.length) return [];

   const insertedRecords: Record<string, ORMInputValue>[] = [];
   const firstRecord = dedupedRecords[0];

   const keys = Object.keys(schema).filter(
    (key) =>
     !schema[key]?.isVirtual &&
     !(schema[key]?.autoIncrement && !firstRecord?.[key]) &&
     !(schema[key]?.generatedAs && !firstRecord?.[key]),
   );

   const mappedKeys = mapKeys(schema, options, keys);
   if (timestamps) mappedKeys.push('createdAt', 'updatedAt');
   if (paranoid) mappedKeys.push('deletedAt');

   const placeholders = dedupedRecords
    .map(() => `(${mappedKeys.map(() => '?').join(', ')})`)
    .join(', ');
   const values: ORMInputValue[] = [];

   for (const record of dedupedRecords) {
    const insertData: Record<string, ORMInputValue> = { ...record };
    processTimestampsAndParanoid(insertData, options);
    processRecordData(schema, insertData, options);

    values.push(
     ...mappedKeys.map((key) =>
      handleSQLFunction(
       insertData[key.replace(/_[a-z]/g, (m) => m[1]!.toUpperCase())],
       key,
       underscored,
      ),
     ),
    );
   }

   const sql = `INSERT INTO ${tableName} (${mappedKeys.join(
    ', ',
   )}) VALUES ${placeholders} RETURNING *`;

   try {
    const stmt = db.prepare(sql);
    const result = stmt.all(...values.map(toSQLInputValue)) as Record<
     string,
     ORMInputValue
    >[];
    insertedRecords.push(...result);
   } catch (error) {
    throw error;
   }

   return insertedRecords;
  }

  static async increment(
   fields: Record<string, number>,
   opts: { where: ExtendedWhereOptions; by?: number },
  ): Promise<void> {
   const { where, by = 1 } = opts;
   const updates: string[] = [];
   const values: ORMInputValue[] = [];

   for (const [field, amount] of Object.entries(fields)) {
    const fieldDef = schema[field];
    if (!fieldDef) throw new Error(`Field ${field} not found in schema`);
    if (
     !fieldDef.type ||
     ![DataType.INTEGER, DataType.BIGINT, DataType.FLOAT].includes(
      fieldDef.type,
     )
    ) {
     throw new Error(`Field ${field} is not numeric and cannot be incremented`);
    }

    const column = fieldDef.field ?? field;
    updates.push(`${column} = ${column} + ?`);
    values.push(amount * by);
   }

   const whereClauses: string[] = [];
   const whereStr = parseWhere(where, values);
   if (whereStr) whereClauses.push(whereStr);

   if (options.paranoid) whereClauses.push('deletedAt IS NULL');

   const sql = `UPDATE ${tableName} SET ${updates.join(
    ', ',
   )} WHERE ${whereClauses.join(' AND ')}`;
   db.prepare(sql).run(...values.map(toSQLInputValue));
  }

  static async decrement(
   fields: Record<string, number>,
   options: { where: ExtendedWhereOptions; by?: number },
  ): Promise<void> {
   await this.increment(
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, -v])),
    options,
   );
  }

  static async findOrCreate(opts: {
   where: ExtendedWhereOptions;
   extras: CreationAttributes<typeof schema, typeof options>;
  }): Promise<[Record<string, ORMInputValue>, boolean]> {
   const existing = await this.findOne({ where: opts.where });
   if (existing) return [existing, false];

   const created = await this.create({ ...opts.extras, ...opts.where });
   return [created, true];
  }

  static async restore(restoreOptions: {
   where: ExtendedWhereOptions;
  }): Promise<number | unknown> {
   if (!options.paranoid)
    throw new Error('Cannot restore records when paranoid mode is disabled');
   return this.update({ deletedAt: null }, { where: restoreOptions.where });
  }
 };
}
