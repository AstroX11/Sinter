import {
 ExtendedWhereOptions,
 ModelOptions,
 Schema,
 type ORMInputValue,
} from "./types.js";

/**
 * Operators for querying in a database or ORM.
 * These operators can be used to build complex queries.
 */
export const Op = {
 /**
  * Less than: Used to check if a value is strictly less than the given value.
  * Example: `where: { age: { [Op.lt]: 30 } }` (find records where age is less than 30)
  */
 lt: Symbol("lt"),

 /**
  * Less than or equal to: Used to check if a value is less than or equal to the given value.
  * Example: `where: { age: { [Op.lte]: 30 } }` (find records where age is less than or equal to 30)
  */
 lte: Symbol("lte"),

 /**
  * Greater than: Used to check if a value is strictly greater than the given value.
  * Example: `where: { age: { [Op.gt]: 30 } }` (find records where age is greater than 30)
  */
 gt: Symbol("gt"),

 /**
  * Greater than or equal to: Used to check if a value is greater than or equal to the given value.
  * Example: `where: { age: { [Op.gte]: 30 } }` (find records where age is greater than or equal to 30)
  */
 gte: Symbol("gte"),

 /**
  * Not equal to: Used to check if a value is not equal to the given value.
  * Example: `where: { age: { [Op.ne]: 30 } }` (find records where age is not 30)
  */
 ne: Symbol("ne"),

 /**
  * Equal to: Used to check if a value is equal to the given value.
  * Example: `where: { age: { [Op.eq]: 30 } }` (find records where age is exactly 30)
  */
 eq: Symbol("eq"),

 /**
  * In: Used to check if a value is within a specified set of values.
  * Example: `where: { name: { [Op.in]: ['Alice', 'Bob'] } }` (find records where name is either Alice or Bob)
  */
 in: Symbol("in"),

 /**
  * Not in: Used to check if a value is not in a specified set of values.
  * Example: `where: { name: { [Op.notIn]: ['Alice', 'Bob'] } }` (find records where name is neither Alice nor Bob)
  */
 notIn: Symbol("notIn"),

 /**
  * Like: Used to check if a value matches a specified pattern (supports wildcards).
  * Example: `where: { name: { [Op.like]: 'A%' } }` (find records where name starts with 'A')
  */
 like: Symbol("like"),

 /**
  * Not like: Used to check if a value does not match a specified pattern.
  * Example: `where: { name: { [Op.notLike]: 'A%' } }` (find records where name does not start with 'A')
  */
 notLike: Symbol("notLike"),

 /**
  * Is: Used to check if a value is `NULL` or is equivalent to a specific value.
  * Example: `where: { bio: { [Op.is]: null } }` (find records where bio is `NULL`)
  */
 is: Symbol("is"),
};

export function camelToSnakeCase(str: string): string {
 return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export function col(name: string) {
 return { __col__: name };
}

export function fn(name: string, ...args: any[]) {
 return { __fn__: name, args };
}

export function isORMInputValue(value: unknown): value is ORMInputValue {
 return (
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  value === null ||
  value === undefined ||
  value instanceof Uint8Array ||
  (typeof value === "object" && value !== null)
 );
}

export function parseWhere(
 w: ExtendedWhereOptions,
 values: ORMInputValue[],
): string {
 const clauses: string[] = [];
 for (const [key, val] of Object.entries(w)) {
  if (key === "or" && Array.isArray(val)) {
   clauses.push(`(${val.map((v) => parseWhere(v, values)).join(" OR ")})`);
  } else if (key === "and" && Array.isArray(val)) {
   clauses.push(`(${val.map((v) => parseWhere(v, values)).join(" AND ")})`);
  } else if (typeof val === "object" && val !== null) {
   if ("json" in val) {
    const [path, value] = val.json!;
    clauses.push(`json_extract(${key}, '$.${path}') = ?`);
    values.push(value);
   } else if ("literal" in val) {
    clauses.push(val.literal!);
   } else if ("__col__" in val) {
    clauses.push(`${key} = ${val.__col__}`);
   } else if ("__fn__" in val) {
    const { __fn__, args } = val as { __fn__: string; args: any[] };
    const formattedArgs = args.map((arg: any) =>
     typeof arg === "string" ? `'${arg}'` : arg,
    );
    clauses.push(`${key} = ${__fn__}(${formattedArgs.join(", ")})`);
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
    clauses.push(`${key} IN (${val[Op.in].map(() => "?").join(", ")})`);
    values.push(...val[Op.in]);
   } else if (val[Op.notIn] && Array.isArray(val[Op.notIn])) {
    clauses.push(`${key} NOT IN (${val[Op.notIn].map(() => "?").join(", ")})`);
    values.push(...val[Op.notIn]);
   } else if (val[Op.like]) {
    clauses.push(`${key} LIKE ?`);
    values.push(val[Op.like]);
   } else if (val[Op.notLike]) {
    clauses.push(`${key} NOT LIKE ?`);
    values.push(val[Op.notLike]);
   } else if (val[Op.is] !== undefined) {
    clauses.push(`${key} IS ${val[Op.is] === null ? "NULL" : "NOT NULL"}`);
   } else {
    clauses.push(`${key} = ?`);
    values.push(val);
   }
  } else {
   clauses.push(`${key} = ?`);
   values.push(val);
  }
 }
 return clauses.join(" AND ");
}

export function validateField(
 value: ORMInputValue,
 field: Schema[string],
 key: string,
): void {
 if (
  field.validate &&
  value != null &&
  !(
   typeof value === "object" &&
   ("__fn__" in (value as any) || "__col__" in (value as any))
  )
 ) {
  for (const [rule, validator] of Object.entries(field.validate)) {
   if (!validator(value))
    throw new Error(`Validation failed for ${key}: ${rule}`);
  }
 }
}

export function transformField(
 value: ORMInputValue,
 field: Schema[string],
 setValue: (v: unknown) => void,
): ORMInputValue {
 let result = value;
 if (
  result != null &&
  !(
   typeof result === "object" &&
   ("__fn__" in (result as any) || "__col__" in (result as any))
  )
 ) {
  if (field.transform) result = field.transform(result) as ORMInputValue;
  if (field.set) field.set(result, { value: setValue });
 }
 return result;
}

export function mapKeys(
 schema: Schema,
 options: ModelOptions,
 dataKeys: string[],
): string[] {
 const { underscored = false } = options;
 return dataKeys.map(
  (key) =>
   schema[key]?.field ??
   (underscored ? key.replace(/([A-Z])/g, "_$1").toLowerCase() : key),
 );
}

export function processTimestampsAndParanoid(
 data: Record<string, ORMInputValue>,
 options: ModelOptions,
): void {
 const { timestamps = true, paranoid = false } = options;
 const now = Date.now();

 if (timestamps) {
  data.createdAt = data.createdAt ?? now;
  data.updatedAt = data.updatedAt ?? now;
 }
 if (paranoid) {
  data.deletedAt = data.deletedAt ?? null;
 }
}

export function handleSQLFunction(
 value: ORMInputValue,
 key: string,
 underscored: boolean,
): string | ORMInputValue {
 if (typeof value === "object" && value !== null && "__fn__" in value) {
  const { __fn__, args = [] } = value as { __fn__: string; args?: any[] };
  const formattedArgs = args.map((arg: any) =>
   typeof arg === "string" ? `'${arg}'` : arg,
  );
  const formattedKey = underscored ? camelToSnakeCase(key) : key;
  return `${__fn__}(${[formattedKey, ...formattedArgs].join(", ")})`;
 }
 return value;
}

export function processRecordData(
 schema: Schema,
 data: Record<string, ORMInputValue>,
 options: ModelOptions,
): void {
 const { underscored = false } = options;

 for (const key of Object.keys(schema)) {
  const field = schema[key];
  if (field?.isVirtual) {
   delete data[key];
   continue;
  }

  const dataKey = underscored ? camelToSnakeCase(key) : key;

  if (!(dataKey in data) || data[dataKey] == null) {
   const raw = field?.defaultFn?.() ?? field?.defaultValue;
   data[dataKey] = isORMInputValue(raw) ? raw : data[dataKey];
  }

  data[dataKey] = transformField(
   data[dataKey],
   field!,
   (v) => (data[dataKey] = v as ORMInputValue),
  );
  validateField(data[dataKey], field!, dataKey);
 }
}

export function toSQLInputValue(value: ORMInputValue) {
 if (value === undefined) return null;
 if (
  typeof value === "object" &&
  value !== null &&
  !(value instanceof Uint8Array)
 )
  return JSON.stringify(value);
 if (typeof value === "boolean") return value ? 1 : 0;
 return value;
}

export function normalizeToOrmInput(value: unknown): ORMInputValue {
 if (value === null || value === undefined) {
  return value;
 }
 if (typeof value === "boolean") {
  return value ? 1 : 0;
 }
 if (
  typeof value === "string" ||
  typeof value === "number" ||
  Buffer.isBuffer(value)
 ) {
  return value;
 }
 if (typeof value === "object") {
  return value;
 }
 throw new Error(`Invalid value type for ORMInputValue: ${typeof value}`);
}

export function escapeSQLiteValue(value: unknown): string {
 if (typeof value === "string") {
  // Escape single quotes
  return `'${value.replace(/'/g, "''")}'`;
 } else if (typeof value === "number") {
  return value.toString();
 } else if (typeof value === "boolean") {
  return value ? "1" : "0"; // SQLite treats 0/1 as booleans
 } else if (value === null) {
  return "NULL";
 } else {
  throw new Error(`Unsupported default value type: ${typeof value}`);
 }
}


export const SQLITE_RESERVED_KEYWORDS = new Set([
 'from',
 'select',
 'where',
 'insert',
 'update',
 'delete',
 'create',
 'table',
 'index',
 'trigger',
 'view',
 'on',
 'as',
 'and',
 'or',
 'not',
 'null',
 'is',
 'in',
 'between',
 'like',
 'group',
 'by',
 'having',
 'order',
 'join',
 'inner',
 'outer',
 'left',
 'right',
 'full',
 'union',
 'all',
 'distinct',
 'with',
 'case',
 'when',
 'then',
 'else',
 'end',
 'cast',
 'constraint',
 'primary',
 'key',
 'foreign',
 'references',
 'check',
 'default',
 'alter',
 'drop',
 'add',
 'set',
 'values',
 'into',
 'begin',
 'commit',
 'rollback',
 'transaction',
]);