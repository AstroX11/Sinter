import { DatabaseSync } from 'node:sqlite';
import type { DatabaseSyncOptions, DefineModelOptions, ModelAttributes } from './Types.mts';
import { defineModel } from './generators/index.mjs';

export class Database {
  private db: DatabaseSync;
  private models: Map<string, any> = new Map();

  constructor(location: string, options?: DatabaseSyncOptions) {
    this.db = new DatabaseSync(location, options);
  }

  define(
    modelName: string,
    attributes: ModelAttributes = {},
    options: DefineModelOptions = {},
  ): void {
    defineModel(this.db, this.models, modelName, attributes, options);
  }
}
