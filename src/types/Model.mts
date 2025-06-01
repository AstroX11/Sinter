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
	comment?: string;
	virtualFields?: Record<string, (row: Record<string, unknown>) => unknown>;
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
	name?: string;
	type: string;
	primaryKey?: boolean;
	notNull?: boolean;
	unique?: boolean;
	autoIncrement?: boolean;
	defaultValue?: unknown;
	defaultExpression?: string;
	defaultFn?: () => unknown;
	check?: string;
	collate?: string;
	foreignKey?: ForeignKeyReference;
	generatedAs?: string;
	hidden?: boolean;
	alias?: string;
	virtual?: boolean;
	stored?: boolean;
	computedExpression?: string;
	computedPersisted?: boolean;
	affinity?: "TEXT" | "INTEGER" | "REAL" | "BLOB" | "NUMERIC";
	enumValues?: string[];
	length?: number;
	precision?: number;
	scale?: number;
	get?: (value: unknown, row?: any) => unknown;
	set?: (value: unknown, row?: any) => unknown;
	validate?: (value: unknown) => boolean | string;
	transformIn?: (value: unknown) => unknown;
	transformOut?: (value: unknown) => unknown;
	required?: boolean;
	immutable?: boolean;
	aliasFor?: string;
	description?: string;
	deprecated?: boolean;
	hiddenInSelect?: boolean;
	index?: boolean;
	comment?: string;
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
	comment?: string;
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
}

export interface IndexDefinition {
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
	dependencies: string[];
	expression: string;
	stored?: boolean;
}
export interface QueryOptions {
	select?: string[];
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

export interface JoinClause {
	type: "INNER" | "LEFT";
	table: string;
	on: string;
	alias?: string;
	columns?: string[];
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
