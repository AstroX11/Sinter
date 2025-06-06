import { ModelInstance } from "../abstracts/instance.mjs";

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
	computedProperties: ComputedProperty[];
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

/**
 * Defines a foreign key reference to another table's column.
 */
export interface ForeignKeyReference {
	/** Key of the rederenced model */
	key: string;
	/** Name of the referenced table. */
	table?: string;
	/** Name of the referenced column. */
	column?: string;
	/** Action to take on deletion of the referenced row. */
	onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	/** Action to take on update of the referenced row. */
	onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	/** Match type for the foreign key constraint. */
	match?: "FULL" | "SIMPLE" | "PARTIAL";
	/** Whether the constraint can be deferred. */
	deferrable?: boolean;
	/** Whether the constraint is initially deferred. */
	initiallyDeferred?: boolean;
	/** Name of the foreign key constraint. */
	name?: string;
	/** Model instance to work with  */
	model: ModelInstance;
}

/**
 * Defines a relationship between models.
 */
export interface RelationshipDefinition {
	/** Type of relationship. */
	type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
	/** Name of the target model. */
	targetModel: string;
	/** Name of the foreign key column in the source model. */
	foreignKey: string;
	/** Name of the key column in the source model. */
	sourceKey?: string;
	/** Name of the junction table for many-to-many relationships. */
	through?: string;
	/** Foreign key in the junction table referencing the source model. */
	throughForeignKey?: string;
	/** Foreign key in the junction table referencing the target model. */
	throughSourceKey?: string;
	/** Action to take on deletion of the referenced row. */
	onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	/** Action to take on update of the referenced row. */
	onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	/** Alias for the relationship in queries. */
	as?: string;
	/** Whether to eagerly load the related data. */
	eagerLoad?: boolean;
	/** Name of the constraint for the relationship. */
	constraintName?: string;
	/** Type of join to use in queries. */
	joinType?: "INNER" | "LEFT" | "RIGHT";
	/** Whether the constraint can be deferred. */
	deferrable?: boolean;
	/** Whether the constraint is initially deferred. */
	initiallyDeferred?: boolean;
	/** Comment describing the relationship. */
	comment?: string;
}

/**
 * Defines a table constraint.
 */
export interface ConstraintDefinition {
	/** Name of the constraint. */
	name?: string;
	/** Type of constraint. */
	type: "check" | "foreignKey" | "unique" | "primaryKey";
	/** Expression for check constraints. */
	expression?: string;
	/** Columns included in the constraint. */
	columns?: string[];
	/** Reference details for foreign key constraints. */
	references?: {
		/** Referenced table. */
		table: string;
		/** Referenced columns. */
		columns: string[];
		/** Model instance to work with  */
		model: ModelInstance;
	};
	/** Action to take on deletion of the referenced row. */
	onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	/** Action to take on update of the referenced row. */
	onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
	/** Whether the constraint can be deferred. */
	deferrable?: boolean;
	/** Whether the constraint is initially deferred. */
	initiallyDeferred?: boolean;
}

/**
 * Defines a column in a table.
 */
export interface ColumnDefinition {
	/** Human-readable or programmatic name of the column, inferred from object key if not set. */
	name?: string;
	/** Data type of the column (e.g., STRING, INTEGER, REAL, BOOLEAN, DATE). */
	type: string;
	/** Marks the column as the primary key for the table. */
	primaryKey?: boolean;
	/** Allows the column to store NULL values. */
	allowNull?: boolean;
	/** Forces the column to be NOT NULL, rejecting NULL values. */
	notNull?: boolean;
	/** Ensures all values in the column are unique across the table. */
	unique?: boolean;
	/** Enables automatic increment for numeric primary keys. */
	autoIncrement?: boolean;
	/** Static default value assigned if no value is provided during inserts. */
	defaultValue?: unknown;
	/** Raw SQL expression used as the default value (e.g., CURRENT_TIMESTAMP). */
	defaultExpression?: string;
	/** JavaScript function returning a dynamic default value. */
	defaultFn?: () => unknown;
	/** SQL CHECK constraint to validate values (e.g., "age >= 18"). */
	check?: string;
	/** Collation sequence for text comparison and sorting (e.g., NOCASE). */
	collate?: string;
	/** Defines a foreign key relationship to another table’s column. */
	references?: ForeignKeyReference;
	/** SQL expression for computed or virtual columns (e.g., "first_name || ' ' || last_name"). */
	generatedAs?: string;
	/** Excludes the column from JSON outputs for sensitive or internal fields. */
	hidden?: boolean;
	/** Alternative name (alias) for the column in queries. */
	alias?: string;
	/** Marks the column as virtual, not stored in the database. */
	virtual?: boolean;
	/** Stores the computed column physically in the table (SQLite 3.31+). */
	stored?: boolean;
	/** SQL expression defining the computed value of the column. */
	computedExpression?: string;
	/** Indicates the computed column is stored, not recalculated dynamically. */
	computedPersisted?: boolean;
	/** SQLite internal storage type (e.g., TEXT, INTEGER). */
	affinity?: "TEXT" | "INTEGER" | "REAL" | "BLOB" | "NUMERIC";
	/** List of allowed string values for ENUM-like behavior. */
	enumValues?: string[];
	/** Maximum character length for string columns. */
	length?: number;
	/** Number of digits in numeric columns. */
	precision?: number;
	/** Number of decimal places for numeric columns. */
	scale?: number;
	/** Transforms the column’s value when read from the database. */
	get?: (value: unknown, row?: any) => unknown;
	/** Transforms the value before writing to the database. */
	set?: (value: any, row?: any) => unknown;
	/** Validates the value before writing, returning true or an error message. */
	validate?: (value: any) => boolean | string;
	/** Transforms the value before insertion or update. */
	transformIn?: (value: any) => unknown;
	/** Transforms the value after reading from the database. */
	transformOut?: (value: unknown) => unknown;
	/** Requires a value at the application level (logical requirement). */
	required?: boolean;
	/** Prevents updates to the column once set. */
	immutable?: boolean;
	/** Maps the column to another column as an alias. */
	aliasFor?: string;
	/** Descriptive comment for the column. */
	description?: string;
	/** Marks the column as deprecated for schema phasing out. */
	deprecated?: boolean;
	/** Excludes the column from default SELECT queries. */
	hiddenInSelect?: boolean;
	/** Creates an index on the column for query performance. */
	index?: boolean;
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
		model: ModelInstance;
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
	type: string;
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
