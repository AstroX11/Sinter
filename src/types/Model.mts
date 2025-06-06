export interface ModelDefinition {
	name: string;
	tableName?: string;
	pluralizeTablename?: boolean;
	columns: Record<string, ColumnDefinition>;
	relationships?: RelationshipDefinition[];
	indexes?: IndexDefinition[];
	constraints?: ConstraintDefinition[];
	triggers?: TriggerDefinition[];
	views?: ViewDefinition[];
	withoutRowid?: boolean;
	strict?: boolean;
	createdAtColumn?: string;
	updatedAtColumn?: string;
	deletedAtColumn?: string;
	versionColumn?: string;
	softDelete?: boolean;
	timestamps?: boolean;
	underscored?: boolean;
	displayName?: string;
	virtualFields?: Record<string, (row: Record<string, unknown>) => unknown>;
	computedProperties: ComputedProperty[]
	beforeInsert?: (
		data: Record<string, unknown>
	) => Record<string, unknown> | Promise<Record<string, unknown>>;
	afterInsert?: (data: Record<string, unknown>) => void | Promise<void>;
	beforeUpdate?: (
		data: Record<string, unknown>
	) => Record<string, unknown> | Promise<Record<string, unknown>>;
	afterUpdate?: (data: Record<string, unknown>) => void | Promise<void>;
	beforeDelete?: (data: Record<string, unknown>) => void | Promise<void>;
	afterDelete?: (data: Record<string, unknown>) => void | Promise<void>;
}

export interface ColumnDefinition {
	/**
	 * Human-readable or programmatic name of the column.
	 * If not set explicitly, it will usually be inferred from the object key during table creation.
	 * @example "email"
	 */
	name?: string;

	/**
	 * Data type of the column, following the SQL type system or the library’s abstraction.
	 * Examples include: "STRING", "INTEGER", "REAL", "BOOLEAN", "DATE".
	 * @example "INTEGER"
	 */
	type: string;

	/**
	 * Marks the column as the primary key for the table.
	 * Primary keys uniquely identify each row and can only be set on one or more columns in a table.
	 * @example true
	 */
	primaryKey?: boolean;

	/**
	 * Allows the column to store NULL values.
	 * If true, values may be NULL. If false, NULL is rejected at the database level.
	 * @example true
	 */
	allowNull?: boolean;

	/**
	 * Shortcut for marking the column as NOT NULL (opposite of `allowNull`).
	 * Forces every row to contain a non-NULL value in this column.
	 * @example true
	 */
	notNull?: boolean;

	/**
	 * Ensures all values in this column are unique across the table.
	 * Typically used for fields like email addresses or usernames.
	 * @example true
	 */
	unique?: boolean;

	/**
	 * Enables automatic increment of numeric primary keys.
	 * Useful for auto-generated IDs in tables.
	 * @example true
	 */
	autoIncrement?: boolean;

	/**
	 * The static default value assigned if no explicit value is provided during inserts.
	 * @example "pending"
	 */
	defaultValue?: unknown;

	/**
	 * A raw SQL expression used as the default value, e.g., "CURRENT_TIMESTAMP".
	 * Use this when the default value must be evaluated by SQLite directly.
	 * @example "CURRENT_TIMESTAMP"
	 */
	defaultExpression?: string;

	/**
	 * A JavaScript function returning the default value at runtime.
	 * Offers dynamic defaults like timestamps or UUIDs.
	 * @example () => Date.now()
	 */
	defaultFn?: () => unknown;

	/**
	 * A SQL `CHECK` constraint to validate values at the database level.
	 * Ensures rows meet custom conditions (e.g., "age >= 18").
	 * @example "age >= 18"
	 */
	check?: string;

	/**
	 * Defines the collation sequence for this column (text comparison and sorting).
	 * SQLite supports "BINARY", "NOCASE", and "RTRIM" by default.
	 * @example "NOCASE"
	 */
	collate?: string;

	/**
	 * Defines a foreign key relationship to another table’s column.
	 * Used for relational integrity and joins.
	 * @example { table: "roles", column: "id" }
	 */
	foreignKey?: ForeignKeyReference;

	/**
	 * SQL expression to generate computed or virtual columns.
	 * Makes the column a calculated field, not stored directly.
	 * @example "first_name || ' ' || last_name"
	 */
	generatedAs?: string;

	/**
	 * Marks this column to be excluded from JSON outputs (API responses, etc.).
	 * Useful for sensitive data or internal-only fields.
	 * @example true
	 */
	hidden?: boolean;

	/**
	 * Alternative name (alias) for this column, used during query building.
	 * Can simplify queries or resolve naming conflicts.
	 * @example "userEmail"
	 */
	alias?: string;

	/**
	 * Declares the column as virtual, meaning it is not stored in the database.
	 * Virtual columns exist only in your data model and queries.
	 * @example true
	 */
	virtual?: boolean;

	/**
	 * If true, stores the result of computed expressions physically in the table (SQLite 3.31+).
	 * Otherwise, computed columns are recalculated on-the-fly.
	 * @example true
	 */
	stored?: boolean;

	/**
	 * SQL expression that defines the computed value of this column.
	 * Typically used with `virtual` or `stored` columns.
	 * @example "price * quantity"
	 */
	computedExpression?: string;

	/**
	 * If true, indicates the computed column is stored (not virtual).
	 * Otherwise, it’s recalculated dynamically.
	 * @example true
	 */
	computedPersisted?: boolean;

	/**
	 * Forces how SQLite internally stores the data (e.g., TEXT, INTEGER).
	 * Mainly relevant for advanced type tuning.
	 * @example "TEXT"
	 */
	affinity?: "TEXT" | "INTEGER" | "REAL" | "BLOB" | "NUMERIC";

	/**
	 * Constrains this column to a list of allowed string values (ENUM-like behavior).
	 * @example ["active", "pending", "inactive"]
	 */
	enumValues?: string[];

	/**
	 * Maximum character length for string columns.
	 * Helps with schema clarity and validation.
	 * @example 255
	 */
	length?: number;

	/**
	 * Number of digits in numeric columns.
	 * Commonly used with `DECIMAL` or `NUMERIC` types.
	 * @example 10
	 */
	precision?: number;

	/**
	 * Number of decimal places for numeric columns.
	 * @example 2
	 */
	scale?: number;

	/**
	 * Custom transformation applied when reading this column’s value from the database.
	 * Can be used for automatic casting or formatting.
	 * @example (value) => value?.toUpperCase()
	 */
	get?: (value: unknown, row?: any) => unknown;

	/**
	 * Custom transformation applied before writing to the database.
	 * Ideal for data sanitization (e.g., trimming whitespace).
	 * @example (value) => value.trim()
	 */
	set?: (value: any, row?: any) => unknown;

	/**
	 * Function to validate the value before writing to the database.
	 * Should return `true` or an error message string.
	 * @example (email) => email.includes("@") || "Invalid email"
	 */
	validate?: (value: any) => boolean | string;

	/**
	 * Transform value before insertion or update at the database level.
	 * Can adjust formatting or apply conversions.
	 * @example (v) => v.toLowerCase()
	 */
	transformIn?: (value: any) => unknown;

	/**
	 * Transform value after reading from the database.
	 * Great for consistent data output formatting.
	 * @example (v) => v.toUpperCase()
	 */
	transformOut?: (value: unknown) => unknown;

	/**
	 * Indicates the column must always have a value set at the application level (logical requirement).
	 * Unlike `allowNull`, this is enforced in application logic, not the database.
	 * @example true
	 */
	required?: boolean;

	/**
	 * Prevents the column from being updated once set.
	 * Useful for immutable fields like creation timestamps.
	 * @example true
	 */
	immutable?: boolean;

	/**
	 * Marks this column as an alias for another column.
	 * Useful when you want to remap names in your application layer.
	 * @example "first_name"
	 */
	aliasFor?: string;

	/**
	 * Descriptive human-readable comment for this column.
	 * Often used in documentation or admin UIs.
	 * @example "The user's email address"
	 */
	description?: string;

	/**
	 * Marks this column as deprecated.
	 * Can be used to phase out old schema fields.
	 * @example true
	 */
	deprecated?: boolean;

	/**
	 * Excludes this column from SELECT queries by default.
	 * Data still exists, but is hidden unless explicitly requested.
	 * @example true
	 */
	hiddenInSelect?: boolean;

	/**
	 * Creates an index on this column to speed up queries and improve performance.
	 * Recommended for frequently filtered or joined fields.
	 * @example true
	 */
	index?: boolean;
}

export interface ForeignKeyReference {
	table: string;
	column: string;
	onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	match?: "FULL" | "SIMPLE" | "PARTIAL";
	deferrable?: boolean;
	initiallyDeferred?: boolean;
	name?: string;
}

export interface RelationshipDefinition {
	type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
	targetModel: string;
	foreignKey: string;
	sourceKey?: string;
	through?: string;
	throughForeignKey?: string;
	throughSourceKey?: string;
	onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	as?: string;
	eagerLoad?: boolean;
	constraintName?: string;
	joinType?: "INNER" | "LEFT" | "RIGHT";
	deferrable?: boolean;
	initiallyDeferred?: boolean;
	comment?: string;
}

export interface IndexDefinition {
	table: string;
	name: string;
	columns: string[];
	unique?: boolean;
	where?: string;
	order?: "ASC" | "DESC";
	partial?: boolean;
	expression?: string;
	collate?: string;
	include?: string[];
}

export interface ConstraintDefinition {
	name?: string;
	type: "check" | "foreignKey" | "unique" | "primaryKey";
	expression?: string;
	columns?: string[];
	references?: {
		table: string;
		columns: string[];
	};
	onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	deferrable?: boolean;
	initiallyDeferred?: boolean;
}

export interface TriggerDefinition {
	name: string;
	timing: "BEFORE" | "AFTER" | "INSTEAD OF";
	event: "INSERT" | "UPDATE" | "DELETE";
	table: string;
	when?: string;
	statement: string;
	forEachRow?: boolean;
}

export interface ViewDefinition {
	name: string;
	select: string;
	materialized?: boolean;
	recursive?: boolean;
	columns?: string[];
	checkOption?: boolean;
	temporary?: boolean;
	with?: string;
}

export interface ModelHooks {
	beforeCreate?: HookFunction[];
	afterCreate?: HookFunction[];
	beforeUpdate?: HookFunction[];
	afterUpdate?: HookFunction[];
	beforeDelete?: HookFunction[];
	afterDelete?: HookFunction[];
	beforeSave?: HookFunction[];
	afterSave?: HookFunction[];
	beforeValidate?: HookFunction[];
	afterValidate?: HookFunction[];
}

export type HookFunction = (model: any, options?: any) => Promise<void> | void;

export interface ComputedProperty {
	name: string;
	type: string
	dependencies: string[];
	expression: string;
	stored?: boolean;
}
export interface JoinClause {
	type: "INNER" | "LEFT" | "RIGHT";
	table: string;
	alias?: string;
	on: string;
}

export interface QueryOptions {
	select?: string[];
	from: string | string[];
	where?: Record<string, unknown> | string;
	whereParams?: Record<string, unknown>;
	limit?: number;
	offset?: number;
	order?: [string, "ASC" | "DESC"][];
	groupBy?: string[];
	having?: string;
	havingParams?: Record<string, unknown>;
	join?: JoinClause[];
	distinct?: boolean;
	with?: string[];
	union?: { type: "UNION" | "UNION ALL"; query: string }[];
	search?: string;
	window?: string;
	explain?: boolean;
}
export interface ShadowField {
	name: string;
	type: string;
	defaultValue?: unknown;
	hidden?: boolean;
	internal?: boolean;
	computed?: boolean;
	getter?: () => unknown | Promise<unknown>;
	setter?: (value: unknown) => void | Promise<void>;
	validate?: (value: unknown) => boolean | Promise<boolean>;
}

export interface ModelRegistry {
	[modelName: string]: ModelDefinition;
}
