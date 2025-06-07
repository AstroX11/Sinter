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

/**
 * SQLite database wrapper with ORM capabilities.
 */
export class Qunatava extends Database {
	private _relationshipManager: ModelRelationshipManager;
	private models: Map<string, ModelDefinition>;

	/**
	 * Initializes a new Qunatava instance.
	 * @param options - Configuration options for the database.
	 */
	constructor(options: QunatavaOptions = {}) {
		super(options.filename ?? ":memory:", {
			readonly: options.readonly ?? false,
			timeout: options.timeout ?? 5000,
			verbose: options.verbose,
		});
		this.models = new Map();
		if (options.journalMode)
			this.pragma(`journal_mode = ${options.journalMode}`);
		if (options.synchronous)
			this.pragma(`synchronous = ${options.synchronous}`);
		if (options.cacheSize !== undefined)
			this.pragma(`cache_size = ${options.cacheSize}`);
		if (options.pageSize !== undefined)
			this.pragma(`page_size = ${options.pageSize}`);

		this.pragma(`foreign_keys = ON`);

		if (options.walAutoCheckpoint !== undefined)
			this.pragma(`wal_autocheckpoint = ${options.walAutoCheckpoint}`);

		registerSqliteFunctions(this);

		this._relationshipManager = new ModelRelationshipManager();
	}

	/**
	 * Executes a SQL query and returns the result.
	 * @param source - The SQL query string.
	 * @param params - Parameters for the query.
	 * @returns Query result with rows, changes, and last inserted row ID.
	 */
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

	/**
	 * Executes a raw SQL statement.
	 * @param source - The SQL statement to execute.
	 * @returns This instance for chaining.
	 */
	exec(source: string): this {
		return super.exec(source);
	}

	async sync({ force }: { force: boolean }) {
		if (!force) return;

		for (const model of this.models.values()) {
			if (!model) continue;
			this.query(`DELETE FROM ${model.tableName}`);
			defineModel(this, model);
		}
	}

	/**
	 * Creates a database backup.
	 * @param destinationFile - Path to the backup file.
	 * @param options - Backup options.
	 * @returns Promise resolving to backup metadata.
	 */
	backup(
		destinationFile: string,
		options?: BackupOptions
	): Promise<BackupMetadata> {
		return super.backup(destinationFile, options);
	}

	/**
	 * Defines relationships for a model.
	 * @param modelName - Name of the model.
	 * @param relationships - Array of relationship definitions.
	 * @returns This instance for chaining.
	 */
	associations(
		modelName: string,
		relationships: RelationshipDefinition[]
	): this {
		this._relationshipManager.defineRelationships(modelName, relationships);
		const model = this.models.get(modelName);
		if (model) {
			model.relationships = [...(model.relationships || []), ...relationships];
		}
		return this;
	}

	/**
	 * Retrieves a model definition by name.
	 * @param modelName - Name of the model.
	 * @returns The model definition or undefined if not found.
	 */
	getModel(modelName: string): ModelDefinition | undefined {
		return this.models.get(modelName);
	}

	/**
	 * Defines a new model.
	 * @param modelName - Name of the model.
	 * @param columns - Column definitions for the model.
	 * @param options - Additional model options.
	 * @returns A new model instance.
	 */
	define<TColumns extends Record<string, ColumnDefinition>>(
		modelName: string,
		columns: TColumns,
		options: Partial<Omit<ModelDefinition, "columns" | "name">> = {}
	): ModelInstance {
		const relationships =
			this._relationshipManager.getRelationships(modelName) ?? [];

		for (const [columnName, columnDef] of Object.entries(columns)) {
			if (columnDef.references) {
				const targetModelInstance = columnDef.references.table;
				console.log(targetModelInstance);
				const targetModelName =
					typeof targetModelInstance === "string"
						? targetModelInstance
						: modelName;
				const existingRelationship = relationships.find(
					r => r.foreignKey === columnName && r.targetModel === targetModelName
				);
				if (!existingRelationship) {
					relationships.push({
						type: "many-to-one",
						targetModel: targetModelName,
						foreignKey: columnName,
						sourceKey: columnDef.references.key || "id",
						onDelete: columnDef.references.onDelete,
						onUpdate: columnDef.references.onUpdate,
						deferrable: columnDef.references.deferrable,
						initiallyDeferred: columnDef.references.initiallyDeferred,
						constraintName: columnDef.references.name,
						comment: columnDef.description,
					});
				}
			}
		}

		const modelDefinition = defineModel(this, {
			name: modelName,
			columns,
			relationships,
			...options,
		});
		this.models.set(modelName, modelDefinition);
		return new ModelInstance(this, modelDefinition);
	}
}
export default Qunatava;
