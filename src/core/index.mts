import Database, {
	BackupMetadata,
	BackupOptions,
	Statement as StatementType,
} from "better-sqlite3";

import { ModelRelationshipManager } from "../models/relationship.mjs";
import { registerSqliteFunctions } from "../internals/index.js";
import { defineModel, ModelInstance } from "../abstracts/index.mjs";

import type {
	ColumnDefinition,
	ModelDefinition,
	RelationshipDefinition,
	QueryResult,
	QunatavaOptions,
} from "../index.mjs";

export class Qunatava extends Database {
	private _relationshipManager: ModelRelationshipManager;

	constructor(options: QunatavaOptions = {}) {
		super(options.filename ?? ":memory:", {
			readonly: options.readonly ?? false,
			timeout: options.timeout ?? 5000,
			verbose: options.verbose,
		});
		if (options.journalMode) this.pragma(`journal_mode = ${options.journalMode}`);
		if (options.synchronous) this.pragma(`synchronous = ${options.synchronous}`);
		if (options.cacheSize !== undefined)
			this.pragma(`cache_size = ${options.cacheSize}`);
		if (options.pageSize !== undefined)
			this.pragma(`page_size = ${options.pageSize}`);

		if (options.foreignKeys !== undefined)
			this.pragma(`foreign_keys = ${options.foreignKeys ? "ON" : "OFF"}`);

		if (options.walAutoCheckpoint !== undefined)
			this.pragma(`wal_autocheckpoint = ${options.walAutoCheckpoint}`);

		registerSqliteFunctions(this);

		this._relationshipManager = new ModelRelationshipManager();
	}

	query<T = unknown, P extends unknown[] = unknown[]>(
		source: string,
		params: P = [] as P
	): QueryResult<T> {
		const statement: StatementType<P, T> = super.prepare<P, T>(source);
		if (/^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(source)) {
			const rows = statement.all(...params) as T[];
			return { rows, changes: 0, lastInsertRowid: 0 };
		} else {
			const result = statement.run(...params);
			return {
				rows: [],
				changes: result.changes,
				lastInsertRowid: result.lastInsertRowid,
			};
		}
	}

	exec(source: string): this {
		return super.exec(source);
	}

	backup(
		destinationFile: string,
		options?: BackupOptions
	): Promise<BackupMetadata> {
		return super.backup(destinationFile, options);
	}

	associations(
		modelName: string,
		relationships: RelationshipDefinition[]
	): this {
		this._relationshipManager.defineRelationships(modelName, relationships);
		return this;
	}

	getModel(_modelName: string): ModelDefinition | undefined {
		return undefined;
	}

	define<TColumns extends Record<string, ColumnDefinition>>(
		modelName: string,
		columns: TColumns,
		options: Partial<Omit<ModelDefinition, "columns" | "name">> = {}
	): ModelInstance {
		const modelDefinition = defineModel(this, {
			name: modelName,
			columns,
			...options,
		});
		return new ModelInstance(this, modelDefinition);
	}
}

export default Qunatava;
