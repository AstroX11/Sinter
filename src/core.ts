import { DatabaseSync, DatabaseSyncOptions, SupportedValueType } from 'node:sqlite';
import * as dbFunctions from './functions.js';

interface Schema {
  [key: string]: DataType;
}

interface DatabaseOptions extends DatabaseSyncOptions {
  schemas?: { [key: string]: Schema };
}

export const DataTypes = {
  STRING: 'TEXT' as const,
  INTEGER: 'INTEGER' as const,
  BIGINT: 'BIGINT' as const,
  BLOB: 'BLOB' as const,
  NULL: 'NULL' as const,
  DATE: 'TEXT' as const,
  BOOLEAN: 'INTEGER' as const,
  JSON: 'TEXT' as const,
};

export const Op = {
  gt: '>' as const,
  like: 'LIKE' as const,
};

interface ColumnDef {
  type: DataType;
  allowNull?: boolean;
  defaultValue?: SupportedValueType | (() => SupportedValueType);
  primaryKey?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  validate?: { isEmail?: boolean; min?: number; max?: number };
  get?: () => any;
  set?: (value: any) => void;
}

type DataType = (typeof DataTypes)[keyof typeof DataTypes];

interface Association {
  type: 'belongsTo' | 'hasMany' | 'belongsToMany';
  target: Model;
  foreignKey: string;
  through?: string;
}

interface Hook {
  beforeCreate?: (instance: Record<string, SupportedValueType>) => void;
  afterUpdate?: (instance: Record<string, SupportedValueType>) => void;
}

export class Database {
  private db: DatabaseSync;
  private schemas: { [key: string]: Schema } = {};
  private models: { [key: string]: Model } = {};

  constructor(location: string, options: DatabaseOptions = {}) {
    const defaultOptions: DatabaseSyncOptions = {
      open: true,
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      readOnly: false,
      allowExtension: false,
    };
    this.db = new DatabaseSync(location, { ...defaultOptions, ...options });
    if (options.schemas) {
      this.schemas = options.schemas;
    }

    this.createTable = dbFunctions.createTableOnDatabase.bind(this);
    this.sync = dbFunctions.sync.bind(this);
    this.transaction = dbFunctions.transaction.bind(this) as <T>(fn: (t: Transaction) => T) => T;
  }

  createTable: (table: string, columns: Record<string, ColumnDef>) => void;
  sync: () => void;
  transaction: <T>(fn: (t: Transaction) => T) => T;

  define(
    modelName: string,
    attributes: Record<string, ColumnDef>,
    options: { hooks?: Hook } = {},
  ): Model {
    const model = new Model(this, modelName, attributes, options.hooks || {});
    this.models[modelName] = model;
    return model;
  }

  getModel(name: string, attributes?: Record<string, ColumnDef>): Model {
    if (this.models[name]) {
      return this.models[name];
    }
    if (attributes) {
      const model = this.define(name, attributes);
      model.createTable();
      return model;
    }
    const inferredModel = this.define(name, {});
    this.models[name] = inferredModel;
    return inferredModel;
  }

  get raw(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  getSchemas(): { [key: string]: Schema } {
    return this.schemas;
  }
}

export class Model {
  private db: Database;
  private name: string;
  private attributes: Record<string, ColumnDef>;
  private associations: Association[] = [];
  private hooks: Hook;
  private schemaInferred: boolean = false;

  constructor(db: Database, name: string, attributes: Record<string, ColumnDef>, hooks: Hook) {
    this.db = db;
    this.name = name;
    this.attributes = attributes;
    this.hooks = hooks;
    this.schemaInferred = Object.keys(attributes).length === 0;

    this.createTable = dbFunctions.createTable.bind(this);
    this.add = this.add.bind(this);
    this.all = dbFunctions.all.bind(this);
    this.one = dbFunctions.one.bind(this);
    this.update = dbFunctions.update.bind(this);
    this.delete = dbFunctions.del.bind(this);
    this.findOrCreate = dbFunctions.findOrCreate.bind(this);
    this.bulkAdd = dbFunctions.bulkAdd.bind(this);
    this.count = dbFunctions.count.bind(this);
    this.max = dbFunctions.max.bind(this);
    this.min = dbFunctions.min.bind(this);
    this.findByPk = dbFunctions.findByPk.bind(this);
  }

  add(data: Record<string, SupportedValueType>): Record<string, SupportedValueType> {
    if (this.schemaInferred) {
      const tableExists = this.db.raw
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(this.name);
      if (!tableExists) {
        const inferredAttributes: Record<string, ColumnDef> = {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        };
        for (const [key, value] of Object.entries(data)) {
          inferredAttributes[key] = {
            type: this.inferDataType(value),
            allowNull: true,
          };
        }
        this.attributes = inferredAttributes;
        this.createTable();
      }
      this.schemaInferred = false;
    }

    // Handle UNIQUE constraint on name
    let uniqueData = { ...data };
    const nameAttr = this.attributes['name'];
    if (nameAttr?.unique && uniqueData['name']) {
      let baseName = uniqueData['name'] as string;
      let suffix = 1;
      let existing = this.one({ where: { name: baseName } });
      while (existing) {
        uniqueData['name'] = `${baseName}-${suffix}`;
        existing = this.one({ where: { name: uniqueData['name'] } });
        suffix++;
      }
    }

    return dbFunctions.add.call(this, uniqueData);
  }

  private inferDataType(value: any): DataType {
    if (typeof value === 'string') return DataTypes.STRING;
    if (typeof value === 'number')
      return Number.isInteger(value) ? DataTypes.INTEGER : DataTypes.BIGINT;
    if (typeof value === 'boolean') return DataTypes.BOOLEAN;
    if (value instanceof Date) return DataTypes.DATE;
    if (typeof value === 'object' && value !== null) return DataTypes.JSON;
    return DataTypes.NULL;
  }

  createTable = dbFunctions.createTable;
  all = dbFunctions.all;
  one = dbFunctions.one;
  update = dbFunctions.update;
  delete = dbFunctions.del;
  findOrCreate = dbFunctions.findOrCreate;
  bulkAdd = dbFunctions.bulkAdd;
  count = dbFunctions.count;
  max = dbFunctions.max;
  min = dbFunctions.min;
  findByPk = dbFunctions.findByPk;

  belongsTo(target: Model, options: { foreignKey: string }) {
    this.associations.push({ type: 'belongsTo', target, foreignKey: options.foreignKey });
    target.createTable();
  }

  hasMany(target: Model, options: { foreignKey: string }) {
    this.associations.push({ type: 'hasMany', target, foreignKey: options.foreignKey });
    target.createTable();
  }

  belongsToMany(target: Model, options: { through: string; foreignKey: string }) {
    this.associations.push({
      type: 'belongsToMany',
      target,
      foreignKey: options.foreignKey,
      through: options.through,
    });
    target.createTable();
    this.db.createTable(options.through, {
      [`${this.name}Id`]: { type: DataTypes.INTEGER, allowNull: false },
      [`${target.name}Id`]: { type: DataTypes.INTEGER, allowNull: false },
    });
  }

  getAssociations() {
    return this.associations;
  }

  getAttributes() {
    return this.attributes;
  }

  getName() {
    return this.name;
  }

  getHooks() {
    return this.hooks;
  }

  getDb() {
    return this.db;
  }
}

export class Transaction {
  constructor(private db: Database) {
    this.db.raw.exec('BEGIN TRANSACTION');
  }

  commit() {
    this.db.raw.exec('COMMIT');
  }

  rollback() {
    this.db.raw.exec('ROLLBACK');
  }
}
export default Database;
