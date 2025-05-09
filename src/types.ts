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
 BOOLEAN = 'BOOLEAN',
 DATE = 'TEXT',
 DATEONLY = 'TEXT',
 TIME = 'TEXT',
 UUID = 'TEXT',
 JSON = 'OBJECT',
 JSONB = 'OBJECT',
 BLOB = 'BLOB',
 ENUM = 'TEXT',
}

/** Valid ORM input values */
export type ORMInputValue =
 | string
 | number
 | boolean
 | NodeJS.ArrayBufferView
 | object
 | null
 | undefined;

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
 hooks?: Record<string, (...args: unknown[]) => Promise<void>>;
 scopes?: Record<string, Record<string, unknown>>;
 validate?: Record<string, Validator>;
 indexes?: IndexDefinition[];
 strictMode?: boolean;
 withoutRowid?: boolean;
}

/** Map DataType to TypeScript types */
export type DataTypeToTS = {
 [DataType.STRING]: string;
 [DataType.CHAR]: string;
 [DataType.TEXT]: string;
 [DataType.INTEGER]: number;
 [DataType.BIGINT]: number;
 [DataType.FLOAT]: number;
 [DataType.DOUBLE]: number;
 [DataType.DECIMAL]: number;
 [DataType.BOOLEAN]: boolean;
 [DataType.DATE]: string;
 [DataType.DATEONLY]: string;
 [DataType.TIME]: string;
 [DataType.UUID]: string;
 [DataType.JSON]: object | string;
 [DataType.JSONB]: object | string;
 [DataType.BLOB]: Buffer;
 [DataType.ENUM]: string;
};

/** Valid SQLite input values */
export type SQLInputValue = string | number | boolean | null | Buffer;

/** Generate CreationAttributes from Schema */
export type CreationAttributes<S extends Schema, O extends ModelOptions> = {
 [K in keyof S as S[K]['isVirtual'] extends true
  ? never
  : K]: S[K]['allowNull'] extends true
  ? DataTypeToTS[S[K]['type']] | null | undefined
  : S[K]['autoIncrement'] extends true
  ? DataTypeToTS[S[K]['type']] | null | undefined
  : S[K]['generatedAs'] extends string
  ? DataTypeToTS[S[K]['type']] | null | undefined
  : DataTypeToTS[S[K]['type']];
} & (O['timestamps'] extends true
 ? {
    createdAt?: number | null | undefined;
    updatedAt?: number | null | undefined;
   }
 : {}) &
 (O['paranoid'] extends true ? { deletedAt?: number | null | undefined } : {});

/** Where clause value types */
export type WhereValue = any | { json?: [string, any]; literal?: string };

/** Extended where options for queries */
export interface ExtendedWhereOptions {
 [key: string]: WhereValue | ExtendedWhereOptions[] | undefined;
 or?: ExtendedWhereOptions[];
 and?: ExtendedWhereOptions[];
}

/** Include options for associations */
export interface IncludeOptions {
 model: { new (): any };
 as?: string;
 include?: IncludeOptions[];
 required?: boolean;
 attributes?: string[];
}

/** Basic where options */
export interface WhereOptions {
 [key: string]: any | { json?: [string, any]; literal?: string };
}

/** FindAll query options */
export interface FindAllOptions<S extends Schema, O extends ModelOptions> {
 where?: ExtendedWhereOptions;
 include?: IncludeOptions[];
 attributes?: (keyof S | 'createdAt' | 'updatedAt' | 'deletedAt')[];
 limit?: number;
 offset?: number;
 order?: (string | [string, 'ASC' | 'DESC'])[];
 groupBy?: string | string[];
}
