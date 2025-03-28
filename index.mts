import {
  DatabaseSync,
  type DatabaseSyncOptions,
  type StatementResultingChanges,
} from 'node:sqlite';

type ColumnType = 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB';
type SupportedValue = null | number | bigint | string | Uint8Array;

interface ColumnDefinition {
  type: ColumnType;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  defaultValue?: SupportedValue;
}

interface Schema {
  [columnName: string]: ColumnDefinition;
}

interface WhereClause {
  [key: string]: SupportedValue | SupportedValue[] | { [op: string]: SupportedValue };
}

interface QueryOptions {
  where?: WhereClause;
  orderBy?: [string, 'ASC' | 'DESC'][];
  limit?: number;
  offset?: number;
}

interface DatabaseConfig extends DatabaseSyncOptions {
  tableNamePrefix?: string;
  busyTimeout?: number;
}

interface Model<T> {
  create: (data: Partial<T>) => StatementResultingChanges;
  findAll: (options?: QueryOptions) => T[];
  findOne: (options?: QueryOptions) => T | undefined;
  findById: (id: number | bigint) => T | undefined;
  findByPk: (pk: number | bigint) => T | undefined;
  update: (data: Partial<T>, options: { where: WhereClause }) => StatementResultingChanges;
  delete: (where: WhereClause) => StatementResultingChanges;
}

class Database {
  #db: DatabaseSync;
  #models = new Map<string, Model<any>>();
  #config: DatabaseConfig;

  constructor(location: string = ':memory:', config: DatabaseConfig = {}) {
    this.#config = {
      open: true,
      enableForeignKeyConstraints: true,
      tableNamePrefix: '',
      busyTimeout: 5000,
      ...config,
    };

    this.#db = new DatabaseSync(location, {
      open: this.#config.open,
      enableForeignKeyConstraints: this.#config.enableForeignKeyConstraints,
      readOnly: this.#config.readOnly,
    });

    this.#db.exec(`PRAGMA busy_timeout = ${this.#config.busyTimeout}`);
    this.#db.exec('PRAGMA journal_mode = WAL');
  }

  define<T>(tableName: string, schema: Schema): Model<T> {
    const fullTableName = `${this.#config.tableNamePrefix}${tableName}`;

    // Add default primary key if not specified
    const enhancedSchema = !Object.values(schema).some((col) => col.primaryKey)
      ? { id: { type: 'INTEGER', primaryKey: true, autoIncrement: true }, ...schema }
      : { ...schema };

    const columnDefs = Object.entries(enhancedSchema)
      .map(([name, def]) => {
        let defStr = `${name} ${def.type}`;
        if (def.primaryKey) defStr += ' PRIMARY KEY';
        if (def.autoIncrement) defStr += ' AUTOINCREMENT';
        if (!def.nullable) defStr += ' NOT NULL';
        if (def.defaultValue !== undefined)
          defStr += ` DEFAULT ${this.#formatValue(def.defaultValue)}`;
        return defStr;
      })
      .join(', ');

    this.#db.exec(`CREATE TABLE IF NOT EXISTS ${fullTableName} (${columnDefs}) STRICT`);

    const columns = Object.keys(enhancedSchema);
    const primaryKey =
      Object.entries(enhancedSchema).find(([, def]) => def.primaryKey)?.[0] || 'id';

    const model: Model<T> = {
      create: (data) => {
        const values = columns.map((col) => data[col] ?? enhancedSchema[col].defaultValue ?? null);
        const stmt = this.#db.prepare(
          `INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES (${columns
            .map(() => '?')
            .join(', ')})`,
        );
        return stmt.run(...values);
      },

      findAll: (options = {}) => {
        const { sql, params } = this.#buildQuery(fullTableName, options);
        return this.#db.prepare(sql).all(...params) as T[];
      },

      findOne: (options = {}) => {
        const { sql, params } = this.#buildQuery(fullTableName, { ...options, limit: 1 });
        return this.#db.prepare(sql).get(...params) as T | undefined;
      },

      findById: (id) => {
        const stmt = this.#db.prepare(`SELECT * FROM ${fullTableName} WHERE id = ?`);
        return stmt.get(id) as T | undefined;
      },

      findByPk: (pk) => {
        const stmt = this.#db.prepare(`SELECT * FROM ${fullTableName} WHERE ${primaryKey} = ?`);
        return stmt.get(pk) as T | undefined;
      },

      update: (data, options) => {
        const setClause = Object.keys(data)
          .map((key) => `${key} = ?`)
          .join(', ');
        const { whereClause, params: whereParams } = this.#buildWhere(options.where);
        const stmt = this.#db.prepare(`UPDATE ${fullTableName} SET ${setClause} ${whereClause}`);
        return stmt.run(...(Object.values(data) as SupportedValue[]), ...whereParams);
      },

      delete: (where) => {
        const { whereClause, params } = this.#buildWhere(where);
        const stmt = this.#db.prepare(`DELETE FROM ${fullTableName} ${whereClause}`);
        return stmt.run(...params);
      },
    };

    this.#models.set(fullTableName, model);
    return model;
  }

  getModel<T>(tableName: string): Model<T> | undefined {
    return this.#models.get(`${this.#config.tableNamePrefix}${tableName}`);
  }

  #formatValue(value: SupportedValue): string {
    return value === null
      ? 'NULL'
      : typeof value === 'string'
      ? `'${value.replace(/'/g, "''")}'`
      : String(value);
  }

  #buildQuery(tableName: string, options: QueryOptions): { sql: string; params: SupportedValue[] } {
    let sql = `SELECT * FROM ${tableName}`;
    const params: SupportedValue[] = [];

    if (options.where) {
      const { whereClause, params: whereParams } = this.#buildWhere(options.where);
      sql += whereClause;
      params.push(...whereParams);
    }

    if (options.orderBy)
      sql += ` ORDER BY ${options.orderBy.map(([f, d]) => `${f} ${d}`).join(', ')}`;
    if (options.limit) sql += ` LIMIT ${options.limit}`;
    if (options.offset) sql += ` OFFSET ${options.offset}`;

    return { sql, params };
  }

  #buildWhere(where: WhereClause): { whereClause: string; params: SupportedValue[] } {
    if (!Object.keys(where).length) return { whereClause: '', params: [] };

    const conditions: string[] = [];
    const params: SupportedValue[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (Array.isArray(value)) {
        conditions.push(`${key} IN (${value.map(() => '?').join(', ')})`);
        params.push(...value);
      } else if (value && typeof value === 'object') {
        for (const [op, val] of Object.entries(value)) {
          const operator = { $gt: '>', $lt: '<', $gte: '>=', $lte: '<=', $ne: '!=' }[op] || '=';
          conditions.push(`${key} ${operator} ?`);
          params.push(val);
        }
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    return { whereClause: ` WHERE ${conditions.join(' AND ')}`, params };
  }

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

  raw<T>(sql: string, params: SupportedValue[] = []): T[] {
    return this.#db.prepare(sql).all(...params) as T[];
  }

  close(): void {
    this.#db.close();
  }
}

export default Database;
export { Database };
