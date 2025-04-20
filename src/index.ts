import { DatabaseSync } from 'node:sqlite';
import { model } from './functions.js';
import { JournalMode } from './types.js'
import type { DatabaseOptions, ModelOptions, Schema } from './types.js';
import { setupDatabase } from './hooks.js';

export default class Database {
  #db: DatabaseSync;

  constructor(location: string | ':memory:', options: DatabaseOptions = {}) {
    const {
      journalMode = JournalMode.WAL,
      busyTimeout,
      open = true,
      enableForeignKeyConstraints = true,
      enableDoubleQuotedStringLiterals = false,
      readOnly = false,
      allowExtension = false,
      ...otherOptions
    } = options;

    this.#db = new DatabaseSync(location, {
      open,
      enableForeignKeyConstraints,
      enableDoubleQuotedStringLiterals,
      readOnly,
      allowExtension,
      ...otherOptions,
    });

    setupDatabase(this.#db, { journalMode, busyTimeout });
  }

  define(tableName: string, schema: Schema, options: ModelOptions = {}) {
    return model(this.#db, tableName, schema, options);
  }

  static async exec(query: string): Promise<unknown> {
    return Promise.resolve(this.exec(query))
  }

  static async prepare(query: string): Promise<unknown> {
    return Promise.resolve(this.prepare(query))
  }

}
export * from './types.js'