import { DatabaseSync, DatabaseSyncOptions, FunctionOptions, StatementResultingChanges, StatementSync } from 'node:sqlite';

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
  create: (data: Partial<T>) => StatementResultingChanges;
  bulkCreate: (data: Partial<T>[]) => StatementResultingChanges;
  findAll: (options?: QueryOptions) => T[];
  findOne: (options?: QueryOptions) => T | undefined;
  findById: (id: number | bigint) => T | undefined;
  findOrCreate: (options: FindOrCreateOptions<T>) => [T, boolean];
  update: (data: Partial<T>, where: WhereClause) => StatementResultingChanges;
  upsert: (data: Partial<T>) => StatementResultingChanges;
  delete: (where: WhereClause) => StatementResultingChanges;
  destroy: (options?: DestroyOptions) => StatementResultingChanges;
  count: (where?: WhereClause) => number;
  max: (field: keyof T, where?: WhereClause) => number | bigint | undefined;
  min: (field: keyof T, where?: WhereClause) => number | bigint | undefined;
  sum: (field: keyof T, where?: WhereClause) => number | bigint | undefined;
  increment: (fields: keyof T | (keyof T)[], where: WhereClause) => StatementResultingChanges;
  decrement: (fields: keyof T | (keyof T)[], where: WhereClause) => StatementResultingChanges;
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

export class DatabaseManager {
  #db: DatabaseSync;
  #tables = new Map<string, { schema: Schema; statements: Record<string, StatementSync> }>();
  #models = new Map<string, Model<any>>();
  #config: DatabaseConfig;

  /** Constructs a new DatabaseManager instance with optional configuration */
  constructor(location: string = ':memory:', config: DatabaseConfig = {}) {
    this.#config = {
      open: true,
      enableForeignKeyConstraints: true,
      defaultPrimaryKey: 'id',
      autoIncrementByDefault: true,
      tableNamePrefix: '',
      addTimestampsByDefault: false,
      busyTimeout: 5000,
      journalMode: 'WAL',
      enableDefaultCache: false, // Disabled by default
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
  define<T extends Record<string, unknown>>(
    tableName: string,
    schema: Schema
  ): Model<T> {
    const fullTableName = `${this.#config.tableNamePrefix}${tableName}`;
    const enhancedSchema: Schema = { ...schema };

    /** Add default primary key if none specified */
    if (!Object.keys(schema).some(key => schema[key].primaryKey)) {
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
        if (def.defaultValue !== undefined) defStr += ` DEFAULT ${this.#formatValue(def.defaultValue)}`;
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

    const statements = {
      insert: this.#db.prepare(`INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES (${placeholders})`),
      select: this.#db.prepare(`SELECT * FROM ${fullTableName}`),
      findById: this.#db.prepare(`SELECT * FROM ${fullTableName} WHERE ${this.#config.defaultPrimaryKey} = ?`),
      count: this.#db.prepare(`SELECT COUNT(*) as count FROM ${fullTableName}`),
      upsert: this.#db.prepare(`INSERT OR REPLACE INTO ${fullTableName} (${columns.join(', ')}) VALUES (${placeholders})`)
    };

    this.#tables.set(fullTableName, { schema: enhancedSchema, statements });
    const model = this.#createModel<T>(fullTableName);
    this.#models.set(fullTableName, model);
    return model;
  }

  /** Retrieves a previously defined model by table name */
  getModel<T>(tableName: string): Model<T> | undefined {
    const fullTableName = `${this.#config.tableNamePrefix}${tableName}`;
    return this.#models.get(fullTableName) as Model<T> | undefined;
  }

  /** Formats a value for SQLite SQL syntax */
  #formatValue(value: SupportedValueType): string {
    if (value === null) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return String(value);
  }

  /** Creates a model instance for a table */
  #createModel<T extends Record<string, unknown>>(tableName: string): Model<T> {
    const table = this.#tables.get(tableName)!;

    return {
      create: (data: Partial<T>) => {
        const values = Object.keys(table.schema).map(key => {
          const value = data[key];
          const columnDef = table.schema[key];
          if (value === undefined) {
            if (columnDef.defaultValue !== undefined) return columnDef.defaultValue;
            if (columnDef.nullable || columnDef.autoIncrement) return null;
            throw new Error(`Missing required value for non-nullable column: ${key}`);
          }
          if (
            value === null ||
            typeof value === 'number' ||
            typeof value === 'bigint' ||
            typeof value === 'string' ||
            value instanceof Uint8Array
          ) {
            return value as SupportedValueType;
          }
          throw new Error(`Invalid type for column ${key}: ${typeof value}`);
        });
        if (this.#config.addTimestampsByDefault && !data.updatedAt) {
          values[Object.keys(table.schema).indexOf('updatedAt')] = Math.floor(Date.now() / 1000);
        }
        return table.statements.insert.run(...values);
      },

      bulkCreate: (data: Partial<T>[]) => {
        const columns = Object.keys(table.schema);
        const values = data.map(record => 
          `(${columns.map(() => '?').join(', ')})`
        ).join(', ');
        const stmt = this.#db.prepare(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`
        );
        return stmt.run(...data.flatMap(record => {
          const rowValues = columns.map(col => {
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
        }));
      },

      findAll: (options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, options);
        return this.#db.prepare(sql).all(...params) as T[];
      },

      findOne: (options: QueryOptions = {}) => {
        const { sql, params } = this.#buildQuery(tableName, { ...options, limit: 1 });
        return this.#db.prepare(sql).get(...params) as T | undefined;
      },

      findById: (id: number | bigint) => {
        return table.statements.findById.get(id) as T | undefined;
      },

      findOrCreate: (options: FindOrCreateOptions<T>) => {
        const { sql: findSql, params: findParams } = this.#buildQuery(tableName, { 
          where: options.where, 
          limit: 1 
        });
        const findStmt = this.#db.prepare(findSql);
        const record = findStmt.get(...findParams) as T | undefined;

        if (record) return [record, false];

        const data = { ...(options.defaults || {}), ...options.where } as Partial<T>;
        const values = Object.keys(table.schema).map(key => {
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
        const insertStmt = this.#db.prepare(`INSERT INTO ${tableName} (${Object.keys(table.schema).join(', ')}) VALUES (${Object.keys(table.schema).map(() => '?').join(', ')})`);
        insertStmt.run(...values);

        const { sql: findAgainSql, params: findAgainParams } = this.#buildQuery(tableName, { 
          where: options.where, 
          limit: 1 
        });
        const findAgainStmt = this.#db.prepare(findAgainSql);
        const newRecord = findAgainStmt.get(...findAgainParams) as T;

        return [newRecord, true];
      },

      update: (data: Partial<T>, where: WhereClause) => {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const { whereClause, params: whereParams } = this.#buildWhere(where);
        const sql = `UPDATE ${tableName} SET ${setClause}${this.#config.addTimestampsByDefault ? ', updatedAt = ?' : ''} ${whereClause}`;
        const stmt = this.#db.prepare(sql);
        const values = Object.values(data as Record<string, SupportedValueType>);
        if (this.#config.addTimestampsByDefault) values.push(Math.floor(Date.now() / 1000));
        return stmt.run(...values, ...whereParams);
      },

      upsert: (data: Partial<T>) => {
        const values = Object.keys(table.schema).map(key => data[key] as SupportedValueType);
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

      count: (where?: WhereClause) => {
        const { whereClause, params } = this.#buildWhere(where || {});
        const stmt = this.#db.prepare(`SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`);
        return (stmt.get(...params) as { count: number }).count;
      },

      max: (field: keyof T, where?: WhereClause) => {
        const { whereClause, params } = this.#buildWhere(where || {});
        const stmt = this.#db.prepare(`SELECT MAX(${String(field)}) as max FROM ${tableName} ${whereClause}`);
        const result = stmt.get(...params) as { max: number | bigint | null };
        return result.max ?? undefined;
      },

      min: (field: keyof T, where?: WhereClause) => {
        const { whereClause, params } = this.#buildWhere(where || {});
        const stmt = this.#db.prepare(`SELECT MIN(${String(field)}) as min FROM ${tableName} ${whereClause}`);
        const result = stmt.get(...params) as { min: number | bigint | null };
        return result.min ?? undefined;
      },

      sum: (field: keyof T, where?: WhereClause) => {
        const { whereClause, params } = this.#buildWhere(where || {});
        const stmt = this.#db.prepare(`SELECT SUM(${String(field)}) as sum FROM ${tableName} ${whereClause}`);
        const result = stmt.get(...params) as { sum: number | bigint | null };
        return result.sum ?? undefined;
      },

      increment: (fields: keyof T | (keyof T)[], where: WhereClause) => {
        const fieldArray = Array.isArray(fields) ? fields : [fields];
        const setClause = fieldArray.map(f => `${String(f)} = ${String(f)} + 1`).join(', ');
        const { whereClause, params } = this.#buildWhere(where);
        const sql = `UPDATE ${tableName} SET ${setClause}${this.#config.addTimestampsByDefault ? ', updatedAt = ?' : ''} ${whereClause}`;
        const stmt = this.#db.prepare(sql);
        return stmt.run(...(this.#config.addTimestampsByDefault ? [Math.floor(Date.now() / 1000)] : []), ...params);
      },

      decrement: (fields: keyof T | (keyof T)[], where: WhereClause) => {
        const fieldArray = Array.isArray(fields) ? fields : [fields];
        const setClause = fieldArray.map(f => `${String(f)} = ${String(f)} - 1`).join(', ');
        const { whereClause, params } = this.#buildWhere(where);
        const sql = `UPDATE ${tableName} SET ${setClause}${this.#config.addTimestampsByDefault ? ', updatedAt = ?' : ''} ${whereClause}`;
        const stmt = this.#db.prepare(sql);
        return stmt.run(...(this.#config.addTimestampsByDefault ? [Math.floor(Date.now() / 1000)] : []), ...params);
      }
    };
  }

  /** Builds a SQL query with parameters based on options */
  #buildQuery(tableName: string, options: QueryOptions): { sql: string; params: SupportedValueType[] } {
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

  /** Constructs a WHERE clause with parameters */
  #buildWhere(where: WhereClause): { whereClause: string; params: SupportedValueType[] } {
    if (!Object.keys(where).length) return { whereClause: '', params: [] };

    const conditions: string[] = [];
    const params: SupportedValueType[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const operators = value as WhereOperators;
        if (operators.$eq !== undefined) { conditions.push(`${key} = ?`); params.push(operators.$eq); }
        if (operators.$ne !== undefined) { conditions.push(`${key} != ?`); params.push(operators.$ne); }
        if (operators.$gte !== undefined) { conditions.push(`${key} >= ?`); params.push(operators.$gte); }
        if (operators.$gt !== undefined) { conditions.push(`${key} > ?`); params.push(operators.$gt); }
        if (operators.$lte !== undefined) { conditions.push(`${key} <= ?`); params.push(operators.$lte); }
        if (operators.$lt !== undefined) { conditions.push(`${key} < ?`); params.push(operators.$lt); }
        if (operators.$in) { conditions.push(`${key} IN (${operators.$in.map(() => '?').join(', ')})`); params.push(...operators.$in); }
        if (operators.$notIn) { conditions.push(`${key} NOT IN (${operators.$notIn.map(() => '?').join(', ')})`); params.push(...operators.$notIn); }
        if (operators.$like) { conditions.push(`${key} LIKE ?`); params.push(operators.$like); }
        if (operators.$notLike) { conditions.push(`${key} NOT LIKE ?`); params.push(operators.$notLike); }
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
      params
    };
  }

  /** Executes a transaction with the provided callback */
  transaction<T>(callback: (db: DatabaseManager) => T): T {
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
    this.transaction(db => {
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
    options: FunctionOptions = {}
  ): void {
    this.#db.function(name, options, fn);
  }
}