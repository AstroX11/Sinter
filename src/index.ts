import { DatabaseSync } from 'node:sqlite';
import { model } from './functions.js';
import { JournalMode } from './types.js'
import type { DatabaseOptions, ModelOptions, Schema } from './types.js';
import { setupDatabase } from './hooks.js';

export default class Database {
  db: DatabaseSync;

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

    this.db = new DatabaseSync(location, {
      open,
      enableForeignKeyConstraints,
      enableDoubleQuotedStringLiterals,
      readOnly,
      allowExtension,
      ...otherOptions,
    });

    setupDatabase(this.db, { journalMode, busyTimeout });
  }

  define(tableName: string, schema: Schema, options: ModelOptions = {}) {
    return model(this.db, tableName, schema, options);
  }

  exec(sql: string) {
    return this.db.exec(sql)
  }

  prepare(sql: string) {
    return this.db.prepare(sql)
  }

  close() {
    return this.db.close()
  }
}
export * from './functions.js'
export * from './types.js'