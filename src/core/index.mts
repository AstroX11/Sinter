import Database, {
	BackupMetadata,
	BackupOptions,
	Statement as StatementType,
} from "better-sqlite3";

import { ModelRelationshipManager } from "../models/relationship.mjs";
import type {
	QunatavaOptions,
	QueryResult,
	ModelDefinition,
	RelationshipDefinition,
} from "../types/index.mjs";
import { registerSqliteFunctions } from "../internals/index.js";

class Quantava extends Database {
	private modelManager: ModelRelationshipManager;

	constructor(options: QunatavaOptions = {}) {
		super(options.filename ?? ":memory:", {
			readonly: options.readonly ?? false,
			timeout: options.timeout ?? 5000,
			verbose: options.verbose,
		});

		registerSqliteFunctions(this)

		this.modelManager = new ModelRelationshipManager();
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
		this.modelManager.defineRelationships(modelName, relationships);
		return this;
	}

	getModel(modelName: string): ModelDefinition | undefined {
		return this.modelManager.getModel(modelName);
	}
}

export { Quantava };
export default Quantava;
