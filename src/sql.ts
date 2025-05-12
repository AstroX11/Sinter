import { DatabaseSync } from 'node:sqlite';
import { model } from './functions.js';
import { JournalMode } from './types.js';
import { setupDatabase } from './hooks.js';
import type { DatabaseOptions, ModelOptions, Schema } from './types.js';

export class Database {
	private db: DatabaseSync;
	private modelRegistry: Map<string, { new (): any }> = new Map();

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
		const Model = model(this.db, tableName, schema, options);
		this.modelRegistry.set(tableName, Model);
		return Model;
	}

	associate(associations: () => void) {
		associations();
	}

	getModel(tableName: string): { new (): any } | undefined {
		return this.modelRegistry.get(tableName);
	}

	close() {
		return this.db.close();
	}
}
