import { DatabaseSyncOptions } from 'node:sqlite';

/** SQLite journal modes */
export enum JournalMode {
  DELETE = 'DELETE',
  TRUNCATE = 'TRUNCATE',
  PERSIST = 'PERSIST',
  MEMORY = 'MEMORY',
  WAL = 'WAL',
  OFF = 'OFF',
}

/** SQLite database options */
export interface DatabaseOptions extends DatabaseSyncOptions {
  journalMode?: JournalMode;
  busyTimeout?: number;
}

/** Supported SQLite data types */
export enum DataType {
  STRING = 'TEXT',
  CHAR = 'TEXT',
  TEXT = 'TEXT',
  INTEGER = 'INTEGER',
  BIGINT = 'INTEGER',
  FLOAT = 'REAL',
  DOUBLE = 'REAL',
  DECIMAL = 'REAL',
  BOOLEAN = 'INTEGER',
  DATE = 'TEXT',
  DATEONLY = 'TEXT',
  TIME = 'TEXT',
  UUID = 'TEXT',
  JSON = 'TEXT',
  JSONB = 'TEXT',
  BLOB = 'BLOB',
  ENUM = 'TEXT',
}

/** Field-level validator */
export type Validator = (value: unknown) => boolean | Promise<boolean>;

/** SQLite collation types */
type SQLiteCollation = 'BINARY' | 'NOCASE' | 'RTRIM';

/** Core field properties */
interface BaseFieldDefinition {
  type: DataType;
  allowNull?: boolean;
  defaultValue?: string | number | boolean | null;
  defaultFn?: () => string | number | boolean | null;
  field?: string;
  references?: { model: string; key: string };
  onUpdate?: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'SET DEFAULT' | 'NO ACTION';
  onDelete?: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'SET DEFAULT' | 'NO ACTION';
  validate?: Record<string, Validator>;
  comment?: string;
  get?: () => unknown;
  set?: (value: unknown, context: { value: (v: unknown) => void }) => void;
  collation?: SQLiteCollation;
  check?: string;
  hidden?: boolean;
  alias?: string;
  isVirtual?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  hiddenFromSelect?: boolean;
  transient?: boolean;
  transform?: (value: unknown) => unknown;
}

/** Mutually exclusive: `unique` OR `indexed` OR neither */
type UniqueField = { unique: boolean | string; indexed?: never };
type IndexedField = { indexed: true | string; unique?: never };
type NonIndexedField = { unique?: undefined; indexed?: undefined };
type IndexingRules = UniqueField | IndexedField | NonIndexedField;

/** Only INTEGER type can be autoIncrement + must be primaryKey */
type AutoIncrementRule =
  | { type: DataType.INTEGER; autoIncrement: true; primaryKey: true }
  | { autoIncrement?: false | undefined };

/** `generatedAs` can't be combined with autoIncrement */
type GeneratedColumnRule =
  | { generatedAs: string; stored?: boolean; autoIncrement?: never }
  | { generatedAs?: undefined };

/** Final FieldDefinition type */
export type FieldDefinition = BaseFieldDefinition &
  IndexingRules &
  AutoIncrementRule &
  GeneratedColumnRule & {
    primaryKey?: boolean;
  };

/** Schema shape: keys are field names */
export interface Schema {
  [key: string]: FieldDefinition;
}

/** Index definition for CREATE INDEX */
export interface IndexDefinition {
  fields: string[];
  unique?: boolean;
  where?: string;
  name?: string;
  collations?: string[];
  sortOrder?: ('ASC' | 'DESC')[];
  ifNotExists?: boolean;
  expressionIndex?: boolean;
  comment?: string;
}

/** Model-level options */
export interface ModelOptions {
  timestamps?: boolean;
  paranoid?: boolean;
  tableName?: string;
  underscored?: boolean;
  freezeTableName?: boolean;
  hooks?: Record<string, (...args: unknown[]) => void>;
  scopes?: Record<string, Record<string, unknown>>;
  validate?: Record<string, Validator>;
  indexes?: IndexDefinition[];
  strictMode?: boolean;
  withoutRowid?: boolean;
}

// Map DataType to TypeScript types
export type DataTypeToTS = {
  [DataType.STRING]: string;
  [DataType.CHAR]: string;
  [DataType.TEXT]: string;
  [DataType.INTEGER]: number;
  [DataType.BIGINT]: number;
  [DataType.FLOAT]: number;
  [DataType.DOUBLE]: number;
  [DataType.DECIMAL]: number;
  [DataType.BOOLEAN]: number;
  [DataType.DATE]: string;
  [DataType.DATEONLY]: string;
  [DataType.TIME]: string;
  [DataType.UUID]: string;
  [DataType.JSON]: string;
  [DataType.JSONB]: string;
  [DataType.BLOB]: Buffer;
  [DataType.ENUM]: string;
};

// Valid SQLite input values
export type SQLInputValue = string | number | boolean | null | Buffer;

// Generate CreationAttributes from Schema
export type CreationAttributes<S extends Schema, O extends ModelOptions> = {
  [K in keyof S as S[K]['isVirtual'] extends true ? never : K]: S[K]['allowNull'] extends true
  ? S[K]['autoIncrement'] extends true
  ? DataTypeToTS[S[K]['type']] | undefined | null
  : S[K]['generatedAs'] extends string
  ? DataTypeToTS[S[K]['type']] | undefined | null
  : DataTypeToTS[S[K]['type']] | null
  : S[K]['autoIncrement'] extends true
  ? DataTypeToTS[S[K]['type']] | undefined | null
  : S[K]['generatedAs'] extends string
  ? DataTypeToTS[S[K]['type']] | undefined | null
  : DataTypeToTS[S[K]['type']] | null;
} & (O['timestamps'] extends true
  ? { createdAt?: number | null; updatedAt?: number | null }
  : {}) &
  (O['paranoid'] extends true ? { deletedAt?: number | null } : {});