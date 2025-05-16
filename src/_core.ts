import { DatabaseSync } from 'node:sqlite';
import { model } from './_instance.js';
import { JournalMode } from './types.js';
import { modelRegistry } from './utils.js';
import type { DatabaseOptions, ModelOptions, Schema } from './types.js';

export class Database {
	private db: DatabaseSync;

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

		this.db.exec(`PRAGMA journal_mode = ${options.journalMode}`);
		if (options.busyTimeout !== undefined) {
			this.db.exec(`PRAGMA busy_timeout = ${options.busyTimeout}`);
		}
	}

	define(tableName: string, schema: Schema, options: ModelOptions = {}) {
		const Model = model(this.db, tableName, schema, options);
		modelRegistry.set(tableName, Model);
		return Model;
	}

	associate(associations: () => void) {
		associations();
	}

	getModel(tableName: string): { new (): any } | undefined {
		return modelRegistry.get(tableName);
	}

	close() {
		return this.db.close();
	}
}
