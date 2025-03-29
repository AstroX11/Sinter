// types.ts
import type { DatabaseSyncOptions } from 'node:sqlite';

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
  type: string | DataType;

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
  validate?: {
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
  };
}

/**
 * Definition of a data type
 */
export interface DataType {
  /**
   * String representation of the type
   */
  toString(): string;

  /**
   * SQL representation of the type
   */
  toSql(): string;

  /**
   * Type key
   */
  key: string;
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

/**
 * SQLite-specific error
 */
export interface SQLiteError extends Error {
  code: string;
  errcode: number;
  errstr: string;
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
