import { Qunatava } from "../index.mjs";
import { resolveDefaultForSchema } from "../schema/schema-utils.js";
import { escapeColname } from "../utils/escape.js";
import { parseWhere } from "../utils/whereParser.js";
import { mapDataTypeToSQLiteType } from "./mappers.mjs";

/**
 *
 * @param {Qunatava} db - BetterSqlite Extended Class
 * @param {Array<{sql:string; params:string[]}>} queries - An Array of Queries to excute
 */
export function* queryGenerator(db, queries) {
	for (const { sql, params = [] } of queries) {
		yield db.query(sql, params);
	}
}

/**
 * Generates SQL column definitions from a map of column configurations.
 * @param {Object.<string, import("../index.mjs").ColumnDefinition>} columns - A map of column names to their configurations.
 * @yields {{ sql: string, metadata: { index?: boolean, description?: string, deprecated?: boolean, hidden?: boolean, hiddenInSelect?: boolean immutable?: boolean }}}
 */
export function* columnGenerator(columns) {
	for (const [name, config] of Object.entries(columns)) {
		let sqliteType = mapDataTypeToSQLiteType(config.type);
		if (config.length && (sqliteType === "CHAR" || sqliteType === "VARCHAR")) {
			sqliteType += `(${config.length})`;
		}

		if (
			(config.precision !== undefined || config.scale !== undefined) &&
			(sqliteType === "NUMERIC" ||
				sqliteType === "DECIMAL" ||
				sqliteType === "REAL")
		) {
			const precision = config.precision ?? 0;
			const scale = config.scale ?? 0;
			sqliteType += `(${precision},${scale})`;
		}

		let def = `${escapeColname(name)} ${sqliteType}`;
		if (config.primaryKey) def += " PRIMARY KEY";
		if (config.autoIncrement && config.primaryKey && sqliteType === "INTEGER")
			def += " AUTOINCREMENT";
		if (config.allowNull === false || config.notNull || config.required)
			def += " NOT NULL";
		if (config.unique) def += " UNIQUE";

		const defaultValue = resolveDefaultForSchema(config);
		if (defaultValue !== undefined) {
			if (typeof defaultValue === "string") {
				def += ` DEFAULT '${defaultValue.replace(/'/g, "''")}'`;
			} else {
				def += ` DEFAULT ${defaultValue}`;
			}
		}

		if (config.defaultExpression) def += ` DEFAULT (${config.defaultExpression})`;
		if (config.check) def += ` CHECK (${config.check})`;
		if (config.collate) def += ` COLLATE ${config.collate}`;
		if (config.generatedAs || config.computedExpression) {
			def += ` GENERATED ALWAYS AS (${
				config.generatedAs || config.computedExpression
			}) `;
			def += config.stored || config.computedPersisted ? "STORED" : "VIRTUAL";
		}
		if (config.enumValues) {
			def += ` CHECK (${escapeColname(name)} IN (${config.enumValues
				.map(v => `'${v}'`)
				.join(", ")}))`;
		}

		yield {
			sql: def,
			metadata: {
				index: config.index,
				description: config.description,
				deprecated: config.deprecated,
				hidden: config.hidden,
				hiddenInSelect: config.hiddenInSelect,
				immutable: config.immutable,
			},
		};
	}
}

/**
 * @param {import("../index.mjs").RelationshipDefinition[]} relationships
 * @yields {string}
 */
export function* foreignKeysGenerator(relationships) {
	for (const rel of relationships) {
		if (rel.foreignKey && rel.targetModel) {
			let fk = `FOREIGN KEY (${escapeColname(
				rel.foreignKey
			)}) REFERENCES ${escapeColname(rel.targetModel)} (${escapeColname(
				rel.sourceKey || "id"
			)})`;
			if (rel.onDelete) fk += ` ON DELETE ${rel.onDelete}`;
			if (rel.onUpdate) fk += ` ON UPDATE ${rel.onUpdate}`;
			if (rel.deferrable) fk += " DEFERRABLE";
			if (rel.initiallyDeferred) fk += " INITIALLY DEFERRED";
			if (rel.constraintName)
				fk = `CONSTRAINT ${escapeColname(rel.constraintName)} ${fk}`;
			if (rel.comment) fk += ` /* ${rel.comment} */`;
			yield fk;
		}
	}
}

/**
 *
 * @param {import("../index.mjs").IndexDefinition[]} indexes
 */
export function* indexesGenerator(indexes) {
	for (const index of indexes) {
		let sql = `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${escapeColname(
			index.name
		)} ON ${escapeColname(index.table || "table")} (${index.columns
			.map(escapeColname)
			.join(", ")})`;
		if (index.where) sql += ` WHERE ${index.where}`;
		if (index.order) sql += ` ${index.order}`;
		if (index.expression) sql += ` USING ${index.expression}`;
		if (index.collate) sql += ` COLLATE ${index.collate}`;
		if (index.include) sql += ` INCLUDE (${index.include.join(", ")})`;
		yield sql;
	}
}

/**
 *
 * @param {import("../index.mjs").ConstraintDefinition[]} constraints
 */
export function* constraintsGenerator(constraints) {
	for (const constraint of constraints) {
		let sql = "";
		if (constraint.type === "check" && constraint.expression) {
			sql = `CHECK (${constraint.expression})`;
		} else if (constraint.type === "foreignKey" && constraint.references) {
			sql = `FOREIGN KEY (${constraint.columns
				.map(escapeColname)
				.join(", ")}) REFERENCES ${escapeColname(
				constraint.references.table
			)} (${constraint.references.columns.map(escapeColname).join(", ")})`;
			if (constraint.onDelete) sql += ` ON DELETE ${constraint.onDelete}`;
			if (constraint.onUpdate) sql += ` ON UPDATE ${constraint.onUpdate}`;
			if (constraint.deferrable) sql += " DEFERRABLE";
			if (constraint.initiallyDeferred) sql += " INITIALLY DEFERRED";
		} else if (constraint.type === "unique" && constraint.columns) {
			sql = `UNIQUE (${constraint.columns.map(escapeColname).join(", ")})`;
		} else if (constraint.type === "primaryKey" && constraint.columns) {
			sql = `PRIMARY KEY (${constraint.columns.map(escapeColname).join(", ")})`;
		}
		if (constraint.name && sql)
			sql = `CONSTRAINT ${escapeColname(constraint.name)} ${sql}`;
		yield sql;
	}
}

/**
 *
 * @param {import("../index.mjs").TriggerDefinition[]} triggers
 */
export function* triggersGenerator(triggers) {
	for (const trigger of triggers) {
		let sql = `CREATE TRIGGER ${escapeColname(trigger.name)} ${trigger.timing} ${
			trigger.event
		} ON ${escapeColname(trigger.table)}`;
		if (trigger.forEachRow) sql += " FOR EACH ROW";
		if (trigger.when) sql += ` WHEN ${trigger.when}`;
		sql += ` BEGIN ${trigger.statement}; END`;
		yield sql;
	}
}

/**
 *
 * @param {import("../index.mjs").ViewDefinition[]} views
 */
export function* viewsGenerator(views) {
	for (const view of views) {
		let sql = `CREATE ${view.temporary ? "TEMPORARY " : ""}VIEW ${escapeColname(
			view.name
		)}`;
		if (view.columns) sql += ` (${view.columns.map(escapeColname).join(", ")})`;
		sql += ` AS ${view.select}`;
		if (view.with) sql += ` WITH ${view.with}`;
		yield sql;
	}
}

export function* hooksGenerator(hooks, modelName) {
	for (const [hookType, functions] of Object.entries(hooks)) {
		for (const fn of functions) {
			yield { hookType, modelName, fn };
		}
	}
}

/**
 *
 * @param {import("../index.mjs").ComputedProperty[]} computedProperties
 */
export function* computedPropertiesGenerator(computedProperties) {
	for (const prop of computedProperties) {
		let sql = `${escapeColname(prop.name)} AS (${prop.expression})`;
		if (prop.stored) sql += " STORED";
		yield { sql, metadata: { dependencies: prop.dependencies } };
	}
}

/**
 * @param {import("../index.mjs").QueryOptions} options
 * @yields {string}
 */
export function* queryOptionsGenerator(options) {
	if (!options.from) {
		throw new Error(
			"Missing 'from' in query options. 'FROM' clause is mandatory."
		);
	}

	let sql = "";
	const params = [];

	if (options.with?.length) {
		sql += `WITH ${options.with.join(", ")} `;
	}

	sql += "SELECT ";
	if (options.distinct) {
		sql += "DISTINCT ";
	}
	if (options.select?.length) {
		sql += options.select.map(escapeColname).join(", ");
	} else {
		sql += "*";
	}

	sql += ` FROM ${
		Array.isArray(options.from)
			? options.from.map(escapeColname).join(", ")
			: escapeColname(options.from)
	}`;

	if (options.join?.length) {
		for (const join of options.join) {
			sql += ` ${join.type} JOIN ${escapeColname(join.table)}`;
			if (join.alias) {
				sql += ` AS ${escapeColname(join.alias)}`;
			}
			sql += ` ON ${join.on}`;
		}
	}

	if (options.where) {
		sql += ` WHERE ${
			typeof options.where === "string"
				? options.where
				: Object.entries(options.where)
						.map(([key, _]) => `${escapeColname(key)} = ?`)
						.join(" AND ")
		}`;
	}

	if (options.groupBy?.length) {
		sql += ` GROUP BY ${options.groupBy.map(escapeColname).join(", ")}`;
	}

	if (options.having) {
		sql += ` HAVING ${options.having}`;
	}

	if (options.order?.length) {
		sql += ` ORDER BY ${options.order
			.map(([col, dir]) => `${escapeColname(col)} ${dir}`)
			.join(", ")}`;
	}

	if (options.limit !== undefined) {
		sql += ` LIMIT ${options.limit}`;
	}

	if (options.offset !== undefined) {
		sql += ` OFFSET ${options.offset}`;
	}

	if (options.window) {
		sql += ` WINDOW ${options.window}`;
	}

	if (options.explain) {
		sql += `EXPLAIN QUERY PLAN ${sql}`;
	}

	if (options.union?.length) {
		for (const union of options.union) {
			sql += ` ${union.type} ${union.query}`;
		}
	}

	yield sql;
}
