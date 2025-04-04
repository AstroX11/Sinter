// types.ts
import type { DatabaseSyncOptions } from 'node:sqlite';
import { DataTypesValues } from './index.mjs';
import { createModelCreateMethod } from './models/create.js';
import { createFindOrCreateMethod } from './models/findOrCreate.js';
import { createFindByPkMethod } from './models/findByPk.js';
import { createFindOneMethod } from './models/findOne.js';
import { createFindAllMethod } from './models/findAll.js';
import { createMathMethods } from './models/maths.js';
import { createIncrementDecrementMethods } from './models/min_max.js';
import { createBulkCreateMethod } from './models/bulkCreate.js';
import { createUpdateMethod } from './models/update.js';
import { createDestroyMethod } from './models/destroy.js';
import { createTruncateMethod } from './models/truncate.js';
import { createRestoreMethod } from './models/restore.js';
import { createUpsertMethod } from './models/upsert.js';

export interface ModelExports {
  definition: ModelDefinition;
  create: ReturnType<typeof createModelCreateMethod>;
  findOrCreate: ReturnType<typeof createFindOrCreateMethod>;
  findByPk: ReturnType<typeof createFindByPkMethod>;
  findOne: ReturnType<typeof createFindOneMethod>;
  findAll: ReturnType<typeof createFindAllMethod>;
  findAndCountAll: ReturnType<typeof createFindAllMethod>;
  count: ReturnType<typeof createMathMethods>['count'];
  max: ReturnType<typeof createMathMethods>['max'];
  min: ReturnType<typeof createMathMethods>['min'];
  sum: ReturnType<typeof createMathMethods>['sum'];
  increment: ReturnType<typeof createIncrementDecrementMethods>['increment'];
  decrement: ReturnType<typeof createIncrementDecrementMethods>['decrement'];
  bulkCreate: ReturnType<typeof createBulkCreateMethod>;
  update: ReturnType<typeof createUpdateMethod>;
  destroy: ReturnType<typeof createDestroyMethod>;
  truncate: ReturnType<typeof createTruncateMethod>;
  restore: ReturnType<typeof createRestoreMethod>;
  upsert: ReturnType<typeof createUpsertMethod>;
}

/**
 * Definition of a database model
 */
export interface ModelDefinition {
  /**
   * The name of the table
   */
  tableName: string;

  /**
   * Column definitions
   */
  attributes: ModelAttributes;

  /**
   * Model options
   */
  options?: DefineModelOptions;
}

/**
 * Model attribute definitions
 */
export interface ModelAttributes {
  /**
   * Object containing column definitions
   */
  [attribute: string]: ColumnDefinition;
}

/**
 * Definition of a database column
 */
export interface ColumnDefinition {
  /**
   * Data type of the column
   */
  type: DataTypesValues;

  /**
   * Whether this column is a primary key
   */
  primaryKey?: boolean;

  /**
   * Whether this column auto-increments
   */
  autoIncrement?: boolean;

  /**
   * Whether this column allows NULL values
   */
  allowNull?: boolean;

  /**
   * Whether this column must have unique values
   */
  unique?: boolean | string | { name: string; msg: string };

  /**
   * Default value for this column
   */
  defaultValue?: unknown;

  /**
   * References to another table for foreign keys
   */
  references?: {
    table: string;
    column: string;
    model: string;
    key: string;
    onUpdate?: 'CASCADE' | 'RESTRICT' | 'SET NULL';
    onDelete?: 'CASCADE' | 'RESTRICT' | 'SET NULL';
  };

  /**
   * What to do on update of referenced key
   */
  onUpdate?: string;

  /**
   * What to do on delete of referenced row
   */
  onDelete?: string;

  /**
   * Actual column name in the database
   */
  field?: string;

  /**
   * CHECK constraint for this column
   */
  check?: string;

  /**
   * Collation to use for text columns
   */
  collate?: string;

  /**
   * Whether this foreign key can be deferred
   */
  deferrable?: boolean;

  /**
   * Whether this foreign key is initially deferred
   */
  deferred?: boolean;

  /**
   * Column generation expression
   */
  generated?: {
    expression: string;
    stored?: boolean;
  };

  /**
   * Validation rules
   */
  validate?:
    | {
        isEmail?: boolean | { msg: string };
        isUrl?: boolean | { msg: string };
        isIP?: boolean | { msg: string };
        isAlpha?: boolean | { msg: string };
        isAlphanumeric?: boolean | { msg: string };
        isNumeric?: boolean | { msg: string };
        isInt?: boolean | { msg: string };
        isFloat?: boolean | { msg: string };
        len?: [number, number] | { msg: string };
        notIn?: unknown[] | { args: unknown[]; msg: string };
        isIn?: unknown[] | { args: unknown[]; msg: string };
      }
    | ValidationRule[];

  transform?: (value: any) => any;
  get?: () => any;
  set?: (value: any) => void;
}

/**
 * Model definition options
 */
export interface DefineModelOptions {
  /**
   * Custom table name
   */
  tableName?: string;

  /**
   * Model name
   */
  modelName?: string;

  /**
   * Whether to add timestamp columns
   */
  timestamps?: boolean;

  /**
   * Whether to add paranoid deletion
   */
  paranoid?: boolean;

  /**
   * Whether to use snake_case for column names
   */
  underscored?: boolean;

  /**
   * Whether to use the model name as table name
   */
  freezeTableName?: boolean;

  /**
   * Primary key field or fields
   */
  primaryKey?: string | string[];

  /**
   * Whether to use strict mode
   */
  strict?: boolean;

  /**
   * Whether to create table without rowid
   */
  withoutRowid?: boolean;

  /**
   * Whether to create a temporary table
   */
  temporary?: boolean;

  /**
   * Whether to add IF NOT EXISTS to CREATE TABLE
   */
  ifNotExists?: boolean;

  /**
   * Index definitions
   */
  indexes?: IndexDefinition[];

  /**
   * Trigger definitions
   */
  triggers?: TriggerDefinition[];

  /**
   * Virtual table options
   */
  virtual?: {
    using: string;
    args?: string[];
  };

  /**
   * Table-level constraints
   */
  constraints?: {
    unique?: Record<string, string[]>;
    check?: Record<string, string>;
    foreignKey?: Record<
      string,
      {
        fields: string[];
        references: {
          table: string;
          fields: string | string[];
        };
        onDelete?: string;
        onUpdate?: string;
        deferrable?: boolean;
        deferred?: boolean;
      }
    >;
  };
  hooks?: ModelHooks;
  scopes?: Record<string, (criteria?: any) => any>;
}

/**
 * Index definition
 */
export interface IndexDefinition {
  /**
   * Name of the index
   */
  name?: string;

  /**
   * Fields to include in the index
   */
  fields: Array<
    | string
    | {
        name: string;
        order?: string;
        collate?: string;
        expression?: boolean;
      }
  >;

  /**
   * Whether this is a unique index
   */
  unique?: boolean;

  /**
   * WHERE clause for the index
   */
  where?: string;

  /**
   * Whether to add IF NOT EXISTS to CREATE INDEX
   */
  ifNotExists?: boolean;
}

/**
 * Trigger definition
 */
export interface TriggerDefinition {
  /**
   * Name of the trigger
   */
  name: string;

  /**
   * When the trigger fires
   */
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';

  /**
   * Which event activates the trigger
   */
  event: 'INSERT' | 'UPDATE' | 'DELETE';

  /**
   * For UPDATE OF triggers, which columns to watch
   */
  columns?: string[];

  /**
   * WHEN clause for the trigger
   */
  condition?: string;

  /**
   * SQL statements in the trigger body
   */
  statements: string[];

  /**
   * Whether to add IF NOT EXISTS to CREATE TRIGGER
   */
  ifNotExists?: boolean;
}

export type ValidationRule = {
  type: 'min' | 'max' | 'length' | 'pattern' | 'enum' | 'custom';
  value: any;
  message?: string;
};

export type QueryOptions = {
  where?: Record<string, any>;
  limit?: number;
  offset?: number;
  order?: [string, 'ASC' | 'DESC'][];
  include?: string[];
  attributes?: string[];
  paranoid?: boolean;
  raw?: boolean;
  transaction?: string;
};

export type TransactionOptions = {
  isolationLevel?: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE';
  timeout?: number;
  readOnly?: boolean;
};

export type HookFunction = (data: any) => Promise<void> | void;

export type ModelHooks = {
  beforeValidate?: HookFunction[];
  afterValidate?: HookFunction[];
  beforeCreate?: HookFunction[];
  afterCreate?: HookFunction[];
  beforeUpdate?: HookFunction[];
  afterUpdate?: HookFunction[];
  beforeSave?: HookFunction[];
  afterSave?: HookFunction[];
  beforeDelete?: HookFunction[];
  afterDelete?: HookFunction[];
  beforeRestore?: HookFunction[];
  afterRestore?: HookFunction[];
  onError?: HookFunction[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * SQLite-specific error
 */
export interface SQLiteError extends Error {
  code: string;
  errcode: number;
  errstr: string;
}

export type MergeStrategy =
  | 'replace'
  | 'preserve'
  | 'append'
  | 'numeric'
  | ((current: any, incoming: any) => any);

export interface UpsertOptions {
  conflictTarget?: string | string[];
  updateExclude?: string[];
  updateOnly?: string[];
  mergeStrategy?: MergeStrategy;
  where?: Record<string, any>;
  returning?: string | string[];
  beforeUpsert?: (
    values: Record<string, any>,
  ) => Promise<Record<string, any>> | Record<string, any>;
  afterUpsert?: (result: {
    id: number | bigint;
    values: Record<string, any>;
    isNew: boolean;
  }) => Promise<void> | void;
  dryRun?: boolean;
  bulk?: boolean;
  timeout?: number;
  onError?: 'abort' | 'ignore' | 'retry';
  retryOptions?: { attempts: number; backoff: 'fixed' | 'exponential'; delay: number };
  transaction?: 'required' | 'new' | 'none';
  batchSize?: number;
  validate?: (values: Record<string, any>) => Promise<boolean> | boolean;
}

export interface UpdateOptions {
  where?: Record<string, any> | string;
  returning?: string[] | boolean;
  limit?: number;
  transaction?: 'required' | 'new' | 'none';
  timeout?: number;
  onError?: 'abort' | 'ignore' | 'retry';
  retryOptions?: { attempts: number; backoff: 'fixed' | 'exponential'; delay: number };
  dryRun?: boolean;
  validate?: (values: Record<string, any>) => Promise<boolean> | boolean;
  beforeUpdate?: (values: Record<string, any>) => Promise<Record<string, any>> | Record<string, any>;
  afterUpdate?: (result: { changes: number; updatedRecords: any[] }) => Promise<void> | void;
  upsert?: {
    onConflict: string | string[];
    conflictValues: Record<string, any>;
    mergeStrategy?: 'replace' | 'preserve' | 'append' | 'numeric' | ((current: any, incoming: any) => any);
  };
  orderBy?: [string, 'ASC' | 'DESC'][];
  batchSize?: number;
}

export interface BulkCreateOptions {
  transaction?: boolean;
  returnRecords?: boolean;
  ignoreDuplicates?: boolean;
  updateOnConflict?: boolean;
  batchSize?: number;
}


/**
 * Type guard for SQLite errors
 */
export function isSQLiteError(error: unknown): error is SQLiteError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'errcode' in error &&
    'errstr' in error
  );
}

export type { DatabaseSyncOptions };
