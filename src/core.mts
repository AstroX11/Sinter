import { DatabaseSync } from 'node:sqlite';
import type { DatabaseSyncOptions, DefineModelOptions, ModelAttributes } from './Types.mts';
import { defineModel } from './generators/index.mjs';

export class Database {
  private db: DatabaseSync;
  private models: Map<string, any> = new Map();

  constructor(location: string, options?: DatabaseSyncOptions) {
    this.db = new DatabaseSync(location, options);
  }

  define(modelName: string, attributes: ModelAttributes = {}, options: DefineModelOptions = {}) {
    return defineModel(this.db, this.models, modelName, attributes, options);
  }

  /**
   * Closes the database connection synchronously.
   * @throws {Error} If the database is not open
   */
  close(): void {
    this.db.close();
  }

  /**
   * Executes raw SQL query asynchronously without any abstraction.
   * Just runs the query and returns whatever the database returns.
   * @param sql The raw SQL query to execute
   * @param params Optional parameters for prepared statements
   * @returns Promise that resolves with raw database results
   * @throws {Error} If query execution fails
   */
  async raw(sql: string, params: Array<any> = []): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        if (params.length > 0) {
          resolve(stmt.all(...params));
        } else {
          resolve(stmt.all());
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Executes raw SQL query synchronously without any abstraction.
   * Just runs the query and returns whatever the database returns.
   * @param sql The raw SQL query to execute
   * @param params Optional parameters for prepared statements
   * @returns Raw database results
   * @throws {Error} If query execution fails
   */
  rawSync(sql: string, params: Array<any> = []): any {
    const stmt = this.db.prepare(sql);
    return params.length > 0 ? stmt.all(...params) : stmt.all();
  }
}
