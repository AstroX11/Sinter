import {
  DatabaseSync,
  type DatabaseSyncOptions,
  type FunctionOptions,
  type StatementResultingChanges,
  type StatementSync,
} from 'node:sqlite';

interface ColumnDefinition {
  type: 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB' | 'NUMERIC';
  primaryKey?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  unique?: boolean;
  defaultValue?: SupportedValueType;
}

interface Schema {
  [columnName: string]: ColumnDefinition;
}

interface Model<T> {
  findAll: (options?: QueryOptions) => T[];
  findOne: (options?: QueryOptions) => T | undefined;
  findByPk: (id: number | bigint, options?: QueryOptions) => T | undefined;
  findById: (id: number | bigint) => T | undefined;
  findOrCreate: (options: FindOrCreateOptions<T>) => [T, boolean];
  findAndCountAll: (options?: QueryOptions) => { rows: T[]; count: number };
  count: (options?: QueryOptions) => number;
  max: (field: keyof T, options?: QueryOptions) => number | bigint | undefined;
  min: (field: keyof T, options?: QueryOptions) => number | bigint | undefined;
  sum: (field: keyof T, options?: QueryOptions) => number | bigint | undefined;
  describe: () => Record<string, { type: string; allowNull: boolean; defaultValue: any }>;
  create: (data: Partial<T>, options?: { ignoreDuplicates?: boolean }) => StatementResultingChanges;
  bulkCreate: (
    data: Partial<T>[],
    options?: { ignoreDuplicates?: boolean },
  ) => StatementResultingChanges;
  build: (data: Partial<T>) => Instance<T>;
  update: (data: Partial<T>, options: { where: WhereClause }) => StatementResultingChanges;
  upsert: (data: Partial<T>) => StatementResultingChanges;
  delete: (where: WhereClause) => StatementResultingChanges;
  destroy: (options?: DestroyOptions) => StatementResultingChanges;
  truncate: () => StatementResultingChanges;
  increment: (
    fields: keyof T | (keyof T)[],
    options: { where: WhereClause },
  ) => StatementResultingChanges;
  decrement: (
    fields: keyof T | (keyof T)[],
    options: { where: WhereClause },
  ) => StatementResultingChanges;
  sync: (options?: { force?: boolean; alter?: boolean }) => void;
  drop: () => void;
  getTableName: () => string;
}

interface Instance<T> {
  get: (key: keyof T) => SupportedValueType | undefined;
  set: (key: keyof T, value: SupportedValueType) => void;
  save: () => StatementResultingChanges;
  destroy: () => StatementResultingChanges;
  toJSON: () => T;
  changed: (key?: keyof T) => boolean | string[];
  previous: (key: keyof T) => SupportedValueType | undefined;
  increment: (fields: keyof T | (keyof T)[], by?: number) => StatementResultingChanges;
  decrement: (fields: keyof T | (keyof T)[], by?: number) => StatementResultingChanges;
  isNewRecord: boolean;
}

interface WhereClause {
  [key: string]: SupportedValueType | SupportedValueType[] | WhereOperators;
}

interface WhereOperators {
  $eq?: SupportedValueType;
  $ne?: SupportedValueType;
  $gte?: number | bigint;
  $gt?: number | bigint;
  $lte?: number | bigint;
  $lt?: number | bigint;
  $in?: SupportedValueType[];
  $notIn?: SupportedValueType[];
  $like?: string;
  $notLike?: string;
}

interface QueryOptions {
  where?: WhereClause;
  orderBy?: [string, 'ASC' | 'DESC'][];
  limit?: number;
  offset?: number;
  attributes?: string[];
  groupBy?: string[];
  having?: WhereClause;
}

interface FindOrCreateOptions<T> {
  where: WhereClause;
  defaults?: Partial<T>;
}

interface DestroyOptions {
  where?: WhereClause;
  truncate?: boolean;
}

/** Extended database configuration options */
interface DatabaseConfig extends DatabaseSyncOptions {
  /** Default name for primary key column */
  defaultPrimaryKey?: string;
  /** Whether primary keys auto-increment by default */
  autoIncrementByDefault?: boolean;
  /** Optional prefix for all table names */
  tableNamePrefix?: string;
  /** Automatically add createdAt/updatedAt columns */
  addTimestampsByDefault?: boolean;
  /** Timeout in ms for busy database (useful for concurrent access) */
  busyTimeout?: number;
  /** SQLite journal mode */
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  /** Enable default caching optimizations */
  enableDefaultCache?: boolean;
}

type SupportedValueType = null | number | bigint | string | Uint8Array;

class Database {
  #db: DatabaseSync;
  #tables = new Map<string, { schema: Schema; statements: Record<string, StatementSync> }>();
  #models = new Map<string, Model<any>>();
  #config: DatabaseConfig;

  /** Constructs a new DatabaseManager instance with optional configuration */
  constructor(location: string = ':memory:', config: DatabaseConfig = {}) {
    /** Initialize configuration with defaults and user-provided overrides */
    this.#config = {
      /** Default: Keep connection open */
      open: true,
      /** Default: Enable foreign key constraints for data integrity */
      enableForeignKeyConstraints: true,
      /** Default primary key column name */
      defaultPrimaryKey: 'id',
      /** Default: Make primary keys auto-increment */
      autoIncrementByDefault: true,
      /** Default: No prefix for table names */
      tableNamePrefix: '',
      /** Default: Don't add timestamp columns */
      addTimestampsByDefault: false,
      /** Default: 5 second timeout for busy database */
      busyTimeout: 5000,
      /** Default: Use Write-Ahead Logging for better concurrency */
      journalMode: 'WAL',
      /** Default: Don't enable caching optimizations */
      enableDefaultCache: false, // Disabled by default
      /** Merge user-provided config with defaults */
      ...config,
    };

    this.#db = new DatabaseSync(location, {
      open: this.#config.open,
      enableForeignKeyConstraints: this.#config.enableForeignKeyConstraints,
      readOnly: this.#config.readOnly,
      allowExtension: this.#config.allowExtension,
      enableDoubleQuotedStringLiterals: this.#config.enableDoubleQuotedStringLiterals,
    });

    /** Apply additional SQLite configurations */
    this.#db.exec(`PRAGMA busy_timeout = ${this.#config.busyTimeout}`);
    this.#db.exec(`PRAGMA journal_mode = ${this.#config.journalMode}`);

    /** Apply caching optimizations if enabled */
    if (this.#config.enableDefaultCache) {
      /** Set cache size to 20000 pages (~80MB with 4KB page size) */
      this.#db.exec('PRAGMA cache_size = -20000'); // Negative for KB, positive for pages
      /** Enable memory-mapped I/O for 256MB */
      this.#db.exec('PRAGMA mmap_size = 268435456'); // 256MB in bytes
      /** Use normal cache spill behavior */
      this.#db.exec('PRAGMA cache_spill = 1');
      /** Synchronize less aggressively for better performance */
      this.#db.exec('PRAGMA synchronous = NORMAL');
    }
  }

  /** Defines a new table with the given schema */
  define<T extends Record<string, unknown>>(tableName: string, schema: Schema): Model<T> {
    const fullTableName = `${this.#config.tableNamePrefix}${tableName}`;
    const enhancedSchema: Schema = { ...schema };

    /** Add default primary key if none specified */
    if (!Object.keys(schema).some((key) => schema[key].primaryKey)) {
      enhancedSchema[this.#config.defaultPrimaryKey!] = {
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: this.#config.autoIncrementByDefault,
      };
    }

    /** Add timestamps if configured */
    if (this.#config.addTimestampsByDefault) {
      enhancedSchema.createdAt = { type: 'INTEGER', defaultValue: Math.floor(Date.now() / 1000) };
      enhancedSchema.updatedAt = { type: 'INTEGER', defaultValue: Math.floor(Date.now() / 1000) };
    }

    const columnDefs = Object.entries(enhancedSchema)
      .map(([name, def]) => {
        let defStr = `${name} ${def.type}`;
        if (def.primaryKey) defStr += ' PRIMARY KEY';
        if (def.autoIncrement) defStr += ' AUTOINCREMENT';
        if (!def.nullable) defStr += ' NOT NULL';
        if (def.unique) defStr += ' UNIQUE';
        if (def.defaultValue !== undefined)
          defStr += ` DEFAULT ${this.#formatValue(def.defaultValue)}`;
        return defStr;
      })
      .join(', ');

    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS ${fullTableName} (
        ${columnDefs}
      ) STRICT
    `);

    const columns = Object.keys(enhancedSchema);
    const placeholders = columns.map(() => '?').join(', ');

    /** Prepare common SQL statements for this table */
    const statements = {
      /** Statement for inserting new records */
      insert: this.#db.prepare(
        `INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      ),
      /** Statement for selecting all records */
      select: this.#db.prepare(`SELECT * FROM ${fullTableName}`),
      /** Statement for finding a record by primary key */
      findById: this.#db.prepare(
        `SELECT * FROM ${fullTableName} WHERE ${this.#config.defaultPrimaryKey} = ?`,
      ),
      /** Statement for counting total records */
      count: this.#db.prepare(`SELECT COUNT(*) as count FROM ${fullTableName}`),
      /** Statement for upserting (insert or replace) records */
      upsert: this.#db.prepare(
        `INSERT OR REPLACE INTO ${fullTableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      ),
    };

    this.#tables.set(fullTableName, { schema: enhancedSchema, statements });
    const model = this.#createModel<T>(fullTableName);
    this.#models.set(fullTableName, model);
    return model;
  }

  /** Retrieves a previously defined model by table name */
  /**
   * Retrieves a model instance for the specified table name.
   *
   * @template T - The type of the model being retrieved
   * @param tableName - The name of the table without prefix
   * @returns A Model instance for the specified table, or undefined if not found
   *
   * @example
   * ```typescript
   * // Assuming tableNamePrefix is 'app_'
   * const userModel = db.getModel<User>('users');
   * // Returns Model<User> for table 'app_users' if exists, undefined otherwise
   * ```
   *
   * @remarks
   * The method prepends the configured table name prefix to the provided table name
   * before looking up the model. This allows for namespace separation in the database.
   */
  getModel<T>(tableName: string): Model<T> | undefined {
    const fullTableName = `${this.#config.tableNamePrefix}${tableName}`;
    return this.#models.get(fullTableName) as Model<T> | undefined;
  }

  /** Formats a value for SQLite SQL syntax */
  /**
   * Formats a value for use in SQLite queries by converting it to a string representation.
   *
   * @param value - The value to format. Can be a string, number, boolean, null, or undefined.
   * @returns A string representation of the value suitable for SQLite queries.
   *
   * @example
   * ```ts
   * formatValue(null)        // returns "NULL"
   * formatValue("test")      // returns "'test'"
   * formatValue("O'Connor")  // returns "'O''Connor'" (escapes single quotes)
   * formatValue(42)          // returns "42"
   * formatValue(true)        // returns "true"
   * ```
   */
  #formatValue(value: SupportedValueType): string {
    if (value === null) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return String(value);
  }
  /**
   * Creates a new instance of a model with the given data.
   *
   * @template T - The type of the model instance to create
   * @param tableName - The name of the table
   * @param data - Initial data for the instance
   * @returns An Instance<T> object with methods to manipulate the data
   *
   * @example
   * ```ts
   * // Define a model
   * interface User {
   *   id?: number;
   *   name: string;
   *   age: number;
   *   active: number;
   * }
   *
   * const db = new Database(':memory:');
   * const User = db.define<User>('users', {
   *   name: { type: 'TEXT', nullable: false },
   *   age: { type: 'INTEGER', nullable: false },
   *   active: { type: 'INTEGER', defaultValue: 1 }
   * });
   *
   * // Create an instance
   * const user = User.build({
   *   name: 'John',
   *   age: 25
   * });
   *
   * // Modify values
   * user.set('age', 26);
   * console.log(user.get('age')); // 26
   *
   * // Check changes
   * console.log(user.changed('age')); // true
   * console.log(user.previous('age')); // 25
   *
   * // Save to database
   * user.save();
   *
   * // Increment/decrement
   * user.increment('age');
   * user.decrement(['active', 'age'], 2);
   *
   * // Delete from database
   * user.destroy();
   * ```
   */
  #createInstance<T>(tableName: string, data: Partial<T>): Instance<T> {
    const table = this.#tables.get(tableName)!;
    const values: Record<string, SupportedValueType> = {};
    const originalValues: Record<string, SupportedValueType> = {};

    Object.keys(table.schema).forEach((key) => {
      const value = data[key];
      const columnDef = table.schema[key];
      // Handle undefined by using null or defaultValue as appropriate
      if (value === undefined) {
        values[key] =
          columnDef.defaultValue ?? (columnDef.nullable || columnDef.autoIncrement ? null : null);
      } else if (
        value === null ||
        typeof value === 'number' ||
        typeof value === 'bigint' ||
        typeof value === 'string' ||
        value instanceof Uint8Array
      ) {
        values[key] = value as SupportedValueType;
      } else {
        throw new Error(`Invalid type for column ${key}: ${typeof value}`);
      }
      originalValues[key] = values[key];
    });

    return {
      get: (key) => values[key as string],
      set: (key, value) => {
        values[key as string] = value;
      },
      save: () => {
        const cols = Object.keys(values).filter((key) => values[key] !== undefined);
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = this.#db.prepare(
          `INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
        );
        const result = stmt.run(...cols.map((key) => values[key]));
        Object.assign(originalValues, values);
        return result;
      },
      destroy: () => {
        const pk = Object.keys(table.schema).find((key) => table.schema[key].primaryKey);
        if (!pk || values[pk] === undefined)
          throw new Error('Cannot destroy instance without primary key');
        const stmt = this.#db.prepare(`DELETE FROM ${tableName} WHERE ${pk} = ?`);
        return stmt.run(values[pk]);
      },
      toJSON: () => ({ ...values } as T),
      changed: (key) => {
        if (key) return values[key as string] !== originalValues[key as string];
        return Object.keys(values).filter((k) => values[k] !== originalValues[k]);
      },
      previous: (key) => originalValues[key as string],
      increment: (fields, by = 1) => {
        const fieldArray = Array.isArray(fields) ? fields : [fields];
        const setClause = fieldArray.map((f) => `${String(f)} = ${String(f)} + ?`).join(', ');
        const pk = Object.keys(table.schema).find((key) => table.schema[key].primaryKey);
        if (!pk || values[pk] === undefined)
          throw new Error('Cannot increment without primary key');
        const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${pk} = ?`;
        const stmt = this.#db.prepare(sql);
        const params = [...fieldArray.map(() => by), values[pk]];
        return stmt.run(...params);
      },
      decrement: (fields, by = 1) => {
        const fieldArray = Array.isArray(fields) ? fields : [fields];
        const setClause = fieldArray.map((f) => `${String(f)} = ${String(f)} - ?`).join(', ');
        const pk = Object.keys(table.schema).find((key) => table.schema[key].primaryKey);
        if (!pk || values[pk] === undefined)
          throw new Error('Cannot decrement without primary key');
        const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${pk} = ?`;
        const stmt = this.#db.prepare(sql);
        const params = [...fieldArray.map(() => by), values[pk]];
        return stmt.run(...params);
      },
      isNewRecord: true,
    };
  }

  /**
   * Creates a Model instance for interacting with a database table
   * @template T - Type representing the table record structure
   * @param {string} tableName - Name of the table to model
   * @returns {Model<T>} Model instance with CRUD operations
   *
   * @example
   * // Define a User model
   * const User = db.createModel<User>({
   *   id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
   *   name: { type: 'TEXT', nullable: false },
   *   email: { type: 'TEXT', nullable: false, unique: true },
   *   age: { type: 'INTEGER', nullable: true },
   *   createdAt: { type: 'INTEGER', defaultValue: () => Math.floor(Date.now() / 1000) },
   *   updatedAt: { type: 'INTEGER' }
   * });
   *
   * // Example CRUD operations:
   *
   * // Create a record
   * await User.create({ name: 'John', email: 'john@example.com' });
   *
   * // Bulk create records
   * await User.bulkCreate([
   *   { name: 'Alice', email: 'alice@example.com' },
   *   { name: 'Bob', email: 'bob@example.com' }
   * ]);
   *
   * // Find all records
   * const users = await User.findAll();
   *
   * // Find with conditions
   * const adults = await User.findAll({
   *   where: { age: { gt: 18 } },
   *   order: ['name', 'ASC'],
   *   limit: 10
   * });
   *
   * // Find one record
   * const user = await User.findOne({ where: { email: 'john@example.com' } });
   *
   * // Update records
   * await User.update(
   *   { name: 'John Doe' },
   *   { where: { id: 1 } }
   * );
   *
   * // Delete records
   * await User.delete({ where: { id: 1 } });
   */
  #createModel<T extends Record<string, unknown>>(tableName: string): Model<T> {
    const table = this.#tables.get(tableName)!;

    return {
      create: (data: Partial<T>, options = {}) => {
        const values = Object.keys(table.schema).map((key) => {
          const value = data[key];
          const columnDef = table.schema[key];
          if (value === undefined) {
            if (columnDef.defaultValue !== undefined) return columnDef.defaultValue;
            if (columnDef.nullable || columnDef.autoIncrement) return null;
            throw new Error(`Missing required value for non-nullable column: ${key}`);
          }
          return value as SupportedValueType;
        });
        if (this.#config.addTimestampsByDefault && !data.updatedAt) {
          values[Object.keys(table.schema).indexOf('updatedAt')] = Math.floor(Date.now() / 1000);
        }
        const sql = options.ignoreDuplicates
          ? `INSERT OR IGNORE INTO ${tableName} (${Object.keys(table.schema).join(
              ', ',
            )}) VALUES (${values.map(() => '?').join(', ')})`
          : table.statements.insert.sourceSQL; // Use sourceSQL instead of sql
        return this.#db.prepare(sql).run(...values);
      },

      bulkCreate: (data: Partial<T>[], options = {}) => {
        const columns = Object.keys(table.schema);
        const values = data.map((record) => `(${columns.map(() => '?').join(', ')})`).join(', ');
        const sql = options.ignoreDuplicates
          ? `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`
          : `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`;
        return this.#db.prepare(sql).run(
          ...data.flatMap((record) => {
            const rowValues = columns.map((col) => {
              const value = record[col];
              const columnDef = table.schema[col];
              if (value === undefined) {
                if (columnDef.defaultValue !== undefined) return columnDef.defaultValue;
                if (columnDef.nullable || columnDef.autoIncrement) return null;
                throw new Error(`Missing required value for non-nullable column: ${col}`);
              }
              return value as SupportedValueType;
            });
            if (this.#config.addTimestampsByDefault && !record.updatedAt) {
              rowValues[columns.indexOf('updatedAt')] = Math.floor(Date.now() / 1000);
            }
            return rowValues;
          }),
        );
      },

      build: (data: Partial<T>) => this.#createInstance(tableName, data),

      findAll: (options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, options);
        return this.#db.prepare(sql).all(...params) as T[];
      },

      findOne: (options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, { ...options, limit: 1 });
        return this.#db.prepare(sql).get(...params) as T | undefined;
      },

      findByPk: (id: number | bigint, options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, {
          ...options,
          where: { [this.#config.defaultPrimaryKey!]: id },
          limit: 1,
        });
        return this.#db.prepare(sql).get(...params) as T | undefined;
      },

      findById: (id: number | bigint) => {
        return table.statements.findById.get(id) as T | undefined;
      },

      findOrCreate: (options: FindOrCreateOptions<T>) => {
        const { sql: findSql, params: findParams } = this.#buildQuery(tableName, {
          where: options.where,
          limit: 1,
        });
        const findStmt = this.#db.prepare(findSql);
        const record = findStmt.get(...findParams) as T | undefined;

        if (record) return [record, false];

        const data = { ...(options.defaults || {}), ...options.where } as Partial<T>;
        const values = Object.keys(table.schema).map((key) => {
          const value = data[key];
          const columnDef = table.schema[key];
          if (value === undefined) {
            if (columnDef.defaultValue !== undefined) return columnDef.defaultValue;
            if (columnDef.nullable || columnDef.autoIncrement) return null;
            throw new Error(`Missing required value for non-nullable column: ${key}`);
          }
          return value as SupportedValueType;
        });
        if (this.#config.addTimestampsByDefault && !data.updatedAt) {
          values[Object.keys(table.schema).indexOf('updatedAt')] = Math.floor(Date.now() / 1000);
        }
        const insertStmt = this.#db.prepare(
          `INSERT INTO ${tableName} (${Object.keys(table.schema).join(', ')}) VALUES (${Object.keys(
            table.schema,
          )
            .map(() => '?')
            .join(', ')})`,
        );
        insertStmt.run(...values);

        const { sql: findAgainSql, params: findAgainParams } = this.#buildQuery(tableName, {
          where: options.where,
          limit: 1,
        });
        const newRecord = this.#db.prepare(findAgainSql).get(...findAgainParams) as T;

        return [newRecord, true];
      },

      findAndCountAll: (options: QueryOptions = {}) => {
        const { sql: countSql, params: countParams } = this.#buildQuery(tableName, {
          ...options,
          attributes: ['COUNT(*) as count'],
        });
        const countResult = this.#db.prepare(countSql).get(...countParams) as { count: number };
        const { sql, params } = this.#buildQuery(tableName, options);
        const rows = this.#db.prepare(sql).all(...params) as T[];
        return { rows, count: countResult.count };
      },

      count: (options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, {
          ...options,
          attributes: ['COUNT(*) as count'],
        });
        return (this.#db.prepare(sql).get(...params) as { count: number }).count;
      },

      max: (field: keyof T, options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, {
          ...options,
          attributes: [`MAX(${String(field)}) as max`],
        });
        const result = this.#db.prepare(sql).get(...params) as { max: number | bigint | null };
        return result.max ?? undefined;
      },

      min: (field: keyof T, options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, {
          ...options,
          attributes: [`MIN(${String(field)}) as min`],
        });
        const result = this.#db.prepare(sql).get(...params) as { min: number | bigint | null };
        return result.min ?? undefined;
      },

      sum: (field: keyof T, options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, {
          ...options,
          attributes: [`SUM(${String(field)}) as sum`],
        });
        const result = this.#db.prepare(sql).get(...params) as { sum: number | bigint | null };
        return result.sum ?? undefined;
      },

      update: (data: Partial<T>, options: { where: WhereClause }) => {
        const setClause = Object.keys(data)
          .map((key) => `${key} = ?`)
          .join(', ');
        const { whereClause, params: whereParams } = this.#buildWhere(options.where);
        const sql = `UPDATE ${tableName} SET ${setClause}${
          this.#config.addTimestampsByDefault ? ', updatedAt = ?' : ''
        } ${whereClause}`;
        const stmt = this.#db.prepare(sql);
        const values = Object.values(data as Record<string, SupportedValueType>);
        if (this.#config.addTimestampsByDefault) values.push(Math.floor(Date.now() / 1000));
        return stmt.run(...values, ...whereParams);
      },

      upsert: (data: Partial<T>) => {
        const values = Object.keys(table.schema).map((key) => data[key] as SupportedValueType);
        if (this.#config.addTimestampsByDefault && !data.updatedAt) {
          values[Object.keys(table.schema).indexOf('updatedAt')] = Math.floor(Date.now() / 1000);
        }
        return table.statements.upsert.run(...values);
      },

      delete: (where: WhereClause) => {
        const { whereClause, params } = this.#buildWhere(where);
        const stmt = this.#db.prepare(`DELETE FROM ${tableName} ${whereClause}`);
        return stmt.run(...params);
      },

      destroy: (options: DestroyOptions = {}) => {
        if (options.truncate) {
          const stmt = this.#db.prepare(`DELETE FROM ${tableName}`);
          return stmt.run();
        }
        const { whereClause, params } = this.#buildWhere(options.where || {});
        const stmt = this.#db.prepare(`DELETE FROM ${tableName} ${whereClause}`);
        return stmt.run(...params);
      },

      truncate: () => {
        const stmt = this.#db.prepare(`DELETE FROM ${tableName}`);
        return stmt.run();
      },

      increment: (fields: keyof T | (keyof T)[], options: { where: WhereClause }) => {
        const fieldArray = Array.isArray(fields) ? fields : [fields];
        const setClause = fieldArray.map((f) => `${String(f)} = ${String(f)} + 1`).join(', ');
        const { whereClause, params } = this.#buildWhere(options.where);
        const sql = `UPDATE ${tableName} SET ${setClause}${
          this.#config.addTimestampsByDefault ? ', updatedAt = ?' : ''
        } ${whereClause}`;
        const stmt = this.#db.prepare(sql);
        return stmt.run(
          ...(this.#config.addTimestampsByDefault ? [Math.floor(Date.now() / 1000)] : []),
          ...params,
        );
      },

      decrement: (fields: keyof T | (keyof T)[], options: { where: WhereClause }) => {
        const fieldArray = Array.isArray(fields) ? fields : [fields];
        const setClause = fieldArray.map((f) => `${String(f)} = ${String(f)} - 1`).join(', ');
        const { whereClause, params } = this.#buildWhere(options.where);
        const sql = `UPDATE ${tableName} SET ${setClause}${
          this.#config.addTimestampsByDefault ? ', updatedAt = ?' : ''
        } ${whereClause}`;
        const stmt = this.#db.prepare(sql);
        return stmt.run(
          ...(this.#config.addTimestampsByDefault ? [Math.floor(Date.now() / 1000)] : []),
          ...params,
        );
      },

      describe: () => {
        const result = this.#db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
          name: string;
          type: string;
          notnull: number;
          dflt_value: any;
        }>;
        return Object.fromEntries(
          result.map((col) => [
            col.name,
            {
              type: col.type,
              allowNull: col.notnull === 0,
              defaultValue: col.dflt_value,
            },
          ]),
        );
      },

      sync: (options: { force?: boolean; alter?: boolean } = {}) => {
        if (options.force) {
          this.#db.exec(`DROP TABLE IF EXISTS ${tableName}`);
          this.define<T>(tableName.replace(this.#config.tableNamePrefix ?? '', ''), table.schema);
        } else if (options.alter) {
          const current = (() => {
            const result = this.#db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
              name: string;
              type: string;
              notnull: number;
              dflt_value: any;
            }>;
            return Object.fromEntries(
              result.map((col) => [
                col.name,
                {
                  type: col.type,
                  allowNull: col.notnull === 0,
                  defaultValue: col.dflt_value,
                },
              ]),
            );
          })();
          const expected = table.schema;
          for (const [col, def] of Object.entries(expected)) {
            if (!current[col]) {
              const defStr = `${col} ${def.type}${def.nullable ? '' : ' NOT NULL'}${
                def.defaultValue !== undefined
                  ? ` DEFAULT ${this.#formatValue(def.defaultValue)}`
                  : ''
              }`;
              this.#db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${defStr}`);
            }
          }
        }
      },

      drop: () => {
        this.#db.exec(`DROP TABLE IF EXISTS ${tableName}`);
        this.#tables.delete(tableName);
        this.#models.delete(tableName);
      },

      getTableName: () => tableName,
    };
  }

  /**
   * Builds a SQL query with parameters based on provided options
   * @private
   * @param {string} tableName - Name of the table to query
   * @param {QueryOptions} options - Query configuration options
   * @returns {Object} An object containing the SQL string and parameters
   * @property {string} sql - The generated SQL query string
   * @property {SupportedValueType[]} params - The parameter values for the query
   *
   * @example
   * // Basic select query
   * const { sql, params } = this.#buildQuery('users', {});
   * // sql: "SELECT * FROM users"
   * // params: []
   *
   * @example
   * // Conditional query with ordering
   * const { sql, params } = this.#buildQuery('users', {
   *   attributes: ['id', 'name'],
   *   where: { age: { gt: 18 } },
   *   orderBy: [['name', 'ASC']],
   *   limit: 10
   * });
   * // sql: "SELECT id, name FROM users WHERE age > ? ORDER BY name ASC LIMIT 10"
   * // params: [18]
   *
   * @example
   * // Complex query with grouping
   * const { sql, params } = this.#buildQuery('orders', {
   *   attributes: ['customer_id', 'COUNT(*) as order_count'],
   *   where: { status: 'completed' },
   *   groupBy: ['customer_id'],
   *   having: { order_count: { gt: 5 } }
   * });
   * // sql: "SELECT customer_id, COUNT(*) as order_count FROM orders
   * //       WHERE status = ? GROUP BY customer_id HAVING order_count > ?"
   * // params: ['completed', 5]
   */
  #buildQuery(
    tableName: string,
    options: QueryOptions,
  ): { sql: string; params: SupportedValueType[] } {
    let sql = 'SELECT ';
    const params: SupportedValueType[] = [];

    sql += options.attributes ? options.attributes.join(', ') : '*';
    sql += ` FROM ${tableName}`;

    if (options.where) {
      const { whereClause, params: whereParams } = this.#buildWhere(options.where);
      sql += whereClause;
      params.push(...whereParams);
    }

    if (options.groupBy) {
      sql += ` GROUP BY ${options.groupBy.join(', ')}`;
      if (options.having) {
        const { whereClause, params: havingParams } = this.#buildWhere(options.having);
        sql += ` HAVING ${whereClause.slice(7)}`;
        params.push(...havingParams);
      }
    }

    if (options.orderBy) {
      const order = options.orderBy.map(([field, dir]) => `${field} ${dir}`).join(', ');
      sql += ` ORDER BY ${order}`;
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) sql += ` OFFSET ${options.offset}`;
    }

    return { sql, params };
  }

  /**
   * Constructs a WHERE clause with parameters from a WhereClause object
   * @private
   * @param {WhereClause} where - The conditions to build into a WHERE clause
   * @returns {Object} An object containing the WHERE clause string and parameters
   * @property {string} whereClause - The generated WHERE clause (includes " WHERE " prefix)
   * @property {SupportedValueType[]} params - The parameter values for the clause
   *
   * @example
   * // Simple equality condition
   * const { whereClause, params } = this.#buildWhere({ id: 1 });
   * // whereClause: " WHERE id = ?"
   * // params: [1]
   *
   * @example
   * // Multiple conditions
   * const { whereClause, params } = this.#buildWhere({
   *   status: 'active',
   *   age: { $gte: 18 }
   * });
   * // whereClause: " WHERE status = ? AND age >= ?"
   * // params: ['active', 18]
   *
   * @example
   * // IN clause with array
   * const { whereClause, params } = this.#buildWhere({
   *   id: [1, 2, 3]
   * });
   * // whereClause: " WHERE id IN (?, ?, ?)"
   * // params: [1, 2, 3]
   *
   * @example
   * // Complex operators
   * const { whereClause, params } = this.#buildWhere({
   *   name: { $like: '%John%' },
   *   age: { $gt: 21, $lt: 65 },
   *   role: { $in: ['admin', 'editor'] }
   * });
   * // whereClause: " WHERE name LIKE ? AND age > ? AND age < ? AND role IN (?, ?)"
   * // params: ['%John%', 21, 65, 'admin', 'editor']
   *
   * @example
   * // Empty condition
   * const { whereClause, params } = this.#buildWhere({});
   * // whereClause: ""
   * // params: []
   */
  #buildWhere(where: WhereClause): { whereClause: string; params: SupportedValueType[] } {
    if (!Object.keys(where).length) return { whereClause: '', params: [] };

    const conditions: string[] = [];
    const params: SupportedValueType[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const operators = value as WhereOperators;
        if (operators.$eq !== undefined) {
          conditions.push(`${key} = ?`);
          params.push(operators.$eq);
        }
        if (operators.$ne !== undefined) {
          conditions.push(`${key} != ?`);
          params.push(operators.$ne);
        }
        if (operators.$gte !== undefined) {
          conditions.push(`${key} >= ?`);
          params.push(operators.$gte);
        }
        if (operators.$gt !== undefined) {
          conditions.push(`${key} > ?`);
          params.push(operators.$gt);
        }
        if (operators.$lte !== undefined) {
          conditions.push(`${key} <= ?`);
          params.push(operators.$lte);
        }
        if (operators.$lt !== undefined) {
          conditions.push(`${key} < ?`);
          params.push(operators.$lt);
        }
        if (operators.$in) {
          conditions.push(`${key} IN (${operators.$in.map(() => '?').join(', ')})`);
          params.push(...operators.$in);
        }
        if (operators.$notIn) {
          conditions.push(`${key} NOT IN (${operators.$notIn.map(() => '?').join(', ')})`);
          params.push(...operators.$notIn);
        }
        if (operators.$like) {
          conditions.push(`${key} LIKE ?`);
          params.push(operators.$like);
        }
        if (operators.$notLike) {
          conditions.push(`${key} NOT LIKE ?`);
          params.push(operators.$notLike);
        }
      } else if (Array.isArray(value)) {
        conditions.push(`${key} IN (${value.map(() => '?').join(', ')})`);
        params.push(...value);
      } else {
        conditions.push(`${key} = ?`);
        params.push(value as SupportedValueType);
      }
    }

    return {
      whereClause: ` WHERE ${conditions.join(' AND ')}`,
      params,
    };
  }

  /**
   * Executes a database transaction with automatic commit/rollback
   * @template T - The return type of the transaction callback
   * @param {(db: Database) => T} callback - Function containing transaction operations
   * @returns {T} The return value from the callback function
   * @throws {Error} If any operation within the transaction fails
   *
   * @example
   * // Basic transaction
   * const result = db.transaction((tx) => {
   *   tx.create('users', { name: 'Alice', email: 'alice@example.com' });
   *   tx.create('profiles', { userId: 1, bio: 'New user' });
   *   return 'success';
   * });
   *
   * @example
   * // Transaction with error handling
   * try {
   *   db.transaction((tx) => {
   *     tx.update('accounts', { balance: 100 }, { where: { id: 1 } });
   *     tx.update('accounts', { balance: -100 }, { where: { id: 2 } });
   *   });
   * } catch (error) {
   *   console.error('Transaction failed:', error);
   *   // Both updates will be rolled back
   * }
   *
   * @example
   * // Returning data from transaction
   * const newUser = db.transaction((tx) => {
   *   const user = tx.create('users', { name: 'Bob' });
   *   tx.create('logs', { action: 'user_create', userId: user.id });
   *   return tx.findOne('users', { where: { id: user.id } });
   * });
   */
  transaction<T>(callback: (db: Database) => T): T {
    try {
      this.#db.exec('BEGIN TRANSACTION');
      const result = callback(this);
      this.#db.exec('COMMIT');
      return result;
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Executes a raw SQL query */
  raw<T>(sql: string, params: SupportedValueType[] = []): T[] {
    return this.#db.prepare(sql).all(...params) as T[];
  }

  /** Applies a series of migrations */
  migrate(migrations: Array<{ up: string; down: string }>) {
    this.transaction((db) => {
      for (const migration of migrations) {
        db.#db.exec(migration.up);
      }
    });
  }

  /** Compacts the database file */
  vacuum(): void {
    this.#db.exec('VACUUM');
  }

  /** Updates query optimizer statistics */
  analyze(): void {
    this.#db.exec('ANALYZE');
  }

  /** Creates a backup of the database */
  backup(toLocation: string): void {
    const backupDb = new DatabaseSync(toLocation, { open: true });
    this.#db.exec(`VACUUM INTO '${toLocation}'`);
    backupDb.close();
  }

  /** Closes the database connection */
  close(): void {
    this.#db.close();
  }

  /** Adds a custom SQLite function */
  addFunction(
    name: string,
    fn: (...args: SupportedValueType[]) => SupportedValueType,
    options: FunctionOptions = {},
  ): void {
    this.#db.function(name, options, fn);
  }
}

export default Database;
export { Database };
