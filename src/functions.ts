import { Database, Model, DataTypes, Op, Transaction } from './core.js';
import { SupportedValueType } from 'node:sqlite';

interface Where {
  [key: string]:
    | SupportedValueType
    | { [key in (typeof Op)[keyof typeof Op]]?: SupportedValueType };
}

export function createTableOnDatabase(
  this: Database,
  table: string,
  columns: Record<string, any>,
): void {
  const columnDefs = Object.entries(columns)
    .map(([name, def]) => {
      let defStr = `"${name}" ${def.type}`;
      if (def.primaryKey) defStr += ' PRIMARY KEY';
      if (def.autoIncrement) defStr += ' AUTOINCREMENT';
      if (def.allowNull === false) defStr += ' NOT NULL';
      if (def.unique) defStr += ' UNIQUE';
      if ('defaultValue' in def && def.defaultValue !== undefined) {
        const defaultVal =
          typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
        // Ensure JSON objects or complex values are properly quoted as strings
        const quotedVal =
          typeof defaultVal === 'object'
            ? `'${JSON.stringify(defaultVal)}'`
            : JSON.stringify(defaultVal);
        defStr += ` DEFAULT ${quotedVal}`;
      }
      return defStr;
    })
    .join(', ');
  const sql = `CREATE TABLE IF NOT EXISTS "${table}" (${columnDefs}) STRICT`;
  console.log('Executing SQL:', sql); // Debug log
  this.raw.exec(sql);
  this.getSchemas()[table] = Object.fromEntries(
    Object.entries(columns).map(([name, def]) => [name, def.type]),
  );
}

export function createTable(this: Model): void {
  const attributes = this.getAttributes();
  const columnDefs = Object.entries(attributes)
    .map(([name, def]) => {
      let defStr = `"${name}" ${def.type}`; // Escape column names
      if (def.primaryKey) defStr += ' PRIMARY KEY';
      if (def.autoIncrement) defStr += ' AUTOINCREMENT';
      if (def.allowNull === false) defStr += ' NOT NULL';
      if (def.unique) defStr += ' UNIQUE';
      if ('defaultValue' in def && def.defaultValue !== undefined) {
        const defaultVal =
          typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
        // Ensure JSON objects or complex values are properly quoted as strings
        const quotedVal =
          typeof defaultVal === 'object'
            ? `'${JSON.stringify(defaultVal)}'`
            : JSON.stringify(defaultVal);
        defStr += ` DEFAULT ${quotedVal}`;
      }
      return defStr;
    })
    .join(', ');
  const sql = `CREATE TABLE IF NOT EXISTS "${this.getName()}" (${columnDefs}) STRICT`; // Escape table name
  console.log('Executing SQL:', sql); // Debug log
  this.getDb().raw.exec(sql);
  this.getDb().getSchemas()[this.getName()] = Object.fromEntries(
    Object.entries(attributes).map(([name, def]) => [name, def.type]),
  );
}

export function sync(this: Database): void {
  for (const [table, schema] of Object.entries(this.getSchemas())) {
    const columns = Object.entries(schema)
      .map(([col, type]) => `"${col}" ${type}`)
      .join(', '); // Escape column names
    const sql = `CREATE TABLE IF NOT EXISTS "${table}" (id INTEGER PRIMARY KEY AUTOINCREMENT, ${columns}) STRICT`; // Escape table name
    this.raw.exec(sql);
  }
}

function validateData(
  attributes: Record<string, any>,
  data: Record<string, SupportedValueType>,
): Record<string, SupportedValueType> {
  const validatedData: Record<string, SupportedValueType> = {};
  for (const [key, value] of Object.entries(data)) {
    const attr = attributes[key];
    if (!attr) continue;
    if (attr.validate?.isEmail && !/^\S+@\S+\.\S+$/.test(String(value)))
      throw new Error(`${key} must be an email`);
    if (attr.validate?.min !== undefined && Number(value) < attr.validate.min)
      throw new Error(`${key} must be >= ${attr.validate.min}`);
    if (attr.validate?.max !== undefined && Number(value) > attr.validate.max)
      throw new Error(`${key} must be <= ${attr.validate.max}`);
    if (attr.type === DataTypes.BOOLEAN) validatedData[key] = value ? 1 : 0;
    else if (attr.type === DataTypes.JSON) validatedData[key] = JSON.stringify(value);
    else if (attr.type === DataTypes.DATE)
      validatedData[key] = new Date(value as string).toISOString();
    else validatedData[key] = value;
  }
  return validatedData;
}

export function add(
  this: Model,
  data: Record<string, SupportedValueType>,
): Record<string, SupportedValueType> {
  const attributes = this.getAttributes();
  const hooks = this.getHooks();
  let instance = validateData(attributes, data);
  if (hooks.beforeCreate) hooks.beforeCreate(instance);
  const columns = Object.keys(instance);
  if (!columns.length) throw new Error('No valid columns provided');
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO "${this.getName()}" (${columns
    .map((col) => `"${col}"`)
    .join(', ')}) VALUES (${placeholders})`; // Escape table and column names
  const stmt = this.getDb().raw.prepare(sql);
  const values = columns.map((col) => instance[col]);
  const result = stmt.run(...values);
  instance = { ...instance, id: result.lastInsertRowid };
  return applyGetters(attributes, instance);
}

export function all(
  this: Model,
  options: { where?: Where; include?: Model[] } = {},
): Record<string, SupportedValueType>[] {
  const attributes = this.getAttributes();
  let sql = `SELECT * FROM "${this.getName()}"`; // Escape table name
  let conditions;
  if (options.where) {
    conditions = buildWhereClause(attributes, options.where);
    sql += ` WHERE ${conditions.sql}`;
  }
  if (options.include) {
    sql = buildJoinQuery(this, options.include, sql);
  }
  const stmt = this.getDb().raw.prepare(sql);
  const results = options.where ? stmt.all(...conditions!.values) : stmt.all();
  return (results as Record<string, SupportedValueType>[]).map((row) =>
    applyGetters(attributes, row),
  );
}

export function one(
  this: Model,
  options: { where: Where; include?: Model[] },
): Record<string, SupportedValueType> | undefined {
  const attributes = this.getAttributes();
  const conditions = buildWhereClause(attributes, options.where);
  let sql = `SELECT * FROM "${this.getName()}" WHERE ${conditions.sql} LIMIT 1`; // Escape table name
  if (options.include) {
    sql = buildJoinQuery(this, options.include, sql);
  }
  const stmt = this.getDb().raw.prepare(sql);
  const result = stmt.get(...conditions.values) as Record<string, SupportedValueType> | undefined;
  return result ? applyGetters(attributes, result) : undefined;
}

export function update(
  this: Model,
  data: Record<string, SupportedValueType>,
  options: { where: Where },
): number | bigint {
  const attributes = this.getAttributes();
  const hooks = this.getHooks();
  const validData = validateData(attributes, data);
  const validWhere = buildWhereClause(attributes, options.where);
  if (!Object.keys(validData).length) throw new Error('No valid columns to update');
  const updates = Object.keys(validData)
    .map((key) => `"${key}" = ?`)
    .join(', '); // Escape column names
  const sql = `UPDATE "${this.getName()}" SET ${updates} WHERE ${validWhere.sql}`; // Escape table name
  const stmt = this.getDb().raw.prepare(sql);
  const values = [...Object.values(validData), ...validWhere.values];
  const result = stmt.run(...values);
  if (hooks.afterUpdate) {
    const updated = this.one({ where: options.where });
    if (updated) hooks.afterUpdate(updated);
  }
  return result.changes;
}

export function del(this: Model, options: { where: Where }): number | bigint {
  const attributes = this.getAttributes();
  const validWhere = buildWhereClause(attributes, options.where);
  const sql = `DELETE FROM "${this.getName()}" WHERE ${validWhere.sql}`; // Escape table name
  const stmt = this.getDb().raw.prepare(sql);
  const result = stmt.run(...validWhere.values);
  return result.changes;
}

export function findOrCreate(
  this: Model,
  options: { where: Where; defaults?: Record<string, SupportedValueType> },
): [Record<string, SupportedValueType>, boolean] {
  const existing = this.one({ where: options.where });
  if (existing) return [existing, false];
  const plainWhereData = Object.fromEntries(
    Object.entries(options.where).filter(([, value]) => typeof value !== 'object'),
  ) as Record<string, SupportedValueType>;
  const data = { ...plainWhereData, ...options.defaults };
  const created = this.add(data);
  return [created, true];
}

export function bulkAdd(
  this: Model,
  data: Record<string, SupportedValueType>[],
): Record<string, SupportedValueType>[] {
  const results: Record<string, SupportedValueType>[] = [];
  for (const item of data) {
    results.push(this.add(item));
  }
  return results;
}

export function count(this: Model, options: { where?: Where } = {}): number {
  let sql = `SELECT COUNT(*) as count FROM "${this.getName()}"`; // Escape table name
  if (options.where) {
    const conditions = buildWhereClause(this.getAttributes(), options.where);
    sql += ` WHERE ${conditions.sql}`;
    const stmt = this.getDb().raw.prepare(sql);
    const result = stmt.get(...conditions.values) as { count: number };
    return result.count;
  }
  const stmt = this.getDb().raw.prepare(sql);
  const result = stmt.get() as { count: number };
  return result.count;
}

export function max(
  this: Model,
  field: string,
  options: { where?: Where } = {},
): SupportedValueType {
  const attributes = this.getAttributes();
  if (!(field in attributes)) throw new Error(`Field ${field} not found`);
  let sql = `SELECT MAX("${field}") as max FROM "${this.getName()}"`; // Escape field and table name
  if (options.where) {
    const conditions = buildWhereClause(attributes, options.where);
    sql += ` WHERE ${conditions.sql}`;
    const stmt = this.getDb().raw.prepare(sql);
    const result = stmt.get(...conditions.values) as { max: SupportedValueType };
    return result.max;
  }
  const stmt = this.getDb().raw.prepare(sql);
  const result = stmt.get() as { max: SupportedValueType };
  return result.max;
}

export function min(
  this: Model,
  field: string,
  options: { where?: Where } = {},
): SupportedValueType {
  const attributes = this.getAttributes();
  if (!(field in attributes)) throw new Error(`Field ${field} not found`);
  let sql = `SELECT MIN("${field}") as min FROM "${this.getName()}"`; // Escape field and table name
  if (options.where) {
    const conditions = buildWhereClause(attributes, options.where);
    sql += ` WHERE ${conditions.sql}`;
    const stmt = this.getDb().raw.prepare(sql);
    const result = stmt.get(...conditions.values) as { min: SupportedValueType };
    return result.min;
  }
  const stmt = this.getDb().raw.prepare(sql);
  const result = stmt.get() as { min: SupportedValueType };
  return result.min;
}

export function findByPk(
  this: Model,
  id: number | bigint,
): Record<string, SupportedValueType> | undefined {
  const attributes = this.getAttributes();
  const sql = `SELECT * FROM "${this.getName()}" WHERE "id" = ? LIMIT 1`; // Escape table and column name
  const stmt = this.getDb().raw.prepare(sql);
  const result = stmt.get(id) as Record<string, SupportedValueType> | undefined;
  return result ? applyGetters(attributes, result) : undefined;
}

export function transaction<T>(this: Database, fn: (t: Transaction) => T): T {
  const t = new Transaction(this);
  try {
    const result = fn(t);
    t.commit();
    return result;
  } catch (e) {
    t.rollback();
    throw e;
  }
}

function buildWhereClause(
  attributes: Record<string, any>,
  where: Where,
): { sql: string; values: SupportedValueType[] } {
  const conditions: string[] = [];
  const values: SupportedValueType[] = [];
  for (const [key, condition] of Object.entries(where)) {
    if (!(key in attributes)) continue;
    if (typeof condition === 'object' && condition !== null) {
      for (const [op, value] of Object.entries(condition)) {
        conditions.push(`"${key}" ${op} ?`); // Escape column name
        if (value !== undefined) {
          values.push(value);
        }
      }
    } else {
      conditions.push(`"${key}" = ?`); // Escape column name
      values.push(condition);
    }
  }
  if (!conditions.length) throw new Error('No valid where conditions');
  return { sql: conditions.join(' AND '), values };
}

function buildJoinQuery(model: Model, includes: Model[], baseSql: string): string {
  let sql = baseSql;
  for (const include of includes) {
    const associations = model.getAssociations().filter((a) => a.target === include);
    for (const assoc of associations) {
      if (assoc.type === 'belongsTo') {
        sql = `SELECT "${model.getName()}".*, "${include.getName()}".* FROM "${model.getName()}" 
               LEFT JOIN "${include.getName()}" ON "${model.getName()}"."${
          assoc.foreignKey
        }" = "${include.getName()}"."id"`;
      } else if (assoc.type === 'hasMany') {
        sql = `SELECT "${model.getName()}".*, "${include.getName()}".* FROM "${model.getName()}" 
               LEFT JOIN "${include.getName()}" ON "${model.getName()}"."id" = "${include.getName()}"."${
          assoc.foreignKey
        }"`;
      } else if (assoc.type === 'belongsToMany' && assoc.through) {
        sql = `SELECT "${model.getName()}".*, "${include.getName()}".* FROM "${model.getName()}" 
               LEFT JOIN "${assoc.through}" ON "${model.getName()}"."id" = "${
          assoc.through
        }"."${model.getName()}Id" 
               LEFT JOIN "${include.getName()}" ON "${
          assoc.through
        }"."${include.getName()}Id" = "${include.getName()}"."id"`;
      }
    }
  }
  return sql;
}

function applyGetters(
  attributes: Record<string, any>,
  instance: Record<string, SupportedValueType>,
): Record<string, SupportedValueType> {
  const result = { ...instance };
  for (const [key, attr] of Object.entries(attributes)) {
    if (attr.get) result[key] = attr.get.call(result);
    if (attr.type === DataTypes.JSON && result[key])
      result[key] = JSON.parse(JSON.stringify(result[key]));
    if (attr.type === DataTypes.BOOLEAN) result[key] = result[key] ? 1 : 0;
    if (attr.type === DataTypes.DATE && result[key])
      result[key] = new Date(result[key] as string).toString();
  }
  return result;
}
