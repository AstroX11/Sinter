import { escapeColname } from "../utils/escape.js";
import { parseWhere } from "../utils/whereParser.js";
import { mapDataTypeToSQLiteType } from "./mappers.mjs";

export function* queryGenerator(db, queries) {
	for (const { sql, params = [] } of queries) {
		yield db.query(sql, params);
	}
}

export function* columnGenerator(columns) {
	for (const [name, config] of Object.entries(columns)) {
		let sqliteType = mapDataTypeToSQLiteType(config.type);
		if (config.length && (sqliteType === "CHAR" || sqliteType === "VARCHAR")) {
			sqliteType += `(${config.length})`;
		}
		let def = `${escapeColname(name)} ${sqliteType}`;
		if (config.primaryKey) def += " PRIMARY KEY";
		if (config.autoIncrement && config.primaryKey && sqliteType === "INTEGER")
			def += " AUTOINCREMENT";

		if (config.allowNull === false || config.notNull || config.required)
			def += " NOT NULL";

		if (config.unique) def += " UNIQUE";
		if (config.defaultValue !== undefined && config.defaultValue !== null) {
			const dv = config.defaultValue;
			if (typeof dv === "string") {
				def += ` DEFAULT '${dv.replace(/'/g, "''")}'`;
			} else if (typeof dv === "number" || typeof dv === "boolean") {
				def += ` DEFAULT ${+dv}`;
			} else if (typeof dv === "object") {
				const jsonStr = JSON.stringify(dv).replace(/'/g, "''");
				def += ` DEFAULT '${jsonStr}'`;
			} else {
				const literal = String(dv).replace(/'/g, "''");
				def += ` DEFAULT '${literal}'`;
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

export function* computedPropertiesGenerator(computedProperties) {
	for (const prop of computedProperties) {
		let sql = `${escapeColname(prop.name)} AS (${prop.expression})`;
		if (prop.stored) sql += " STORED";
		yield { sql, metadata: { dependencies: prop.dependencies } };
	}
}

export function* queryOptionsGenerator(options) {
	if (!options.from)
		throw new Error(
			"Missing 'from' in query options. 'FROM' clause is mandatory."
		);

	let sql = "";
	const params = [];

	if (options.with?.length) sql += `WITH ${options.with.join(", ")} `;

	sql += "SELECT ";
	if (options.distinct) sql += "DISTINCT ";
	if (options.select?.length)
		sql += options.select.map(escapeColname).join(", ");
	else sql += "*";

	sql += ` FROM ${escapeColname(options.from)}`;

	if (options.join?.length) {
		for (const join of options.join) {
			sql += ` ${join.type} JOIN ${escapeColname(join.table)}`;
			if (join.alias) sql += ` AS ${escapeColname(join.alias)}`;
			sql += ` ON ${join.on}`;
			if (join.columns?.length)
				sql += ` (${join.columns.map(escapeColname).join(", ")})`;
		}
	}

	if (options.where) {
		sql += " WHERE ";
		if (typeof options.where === "string") {
			sql += options.where;
		} else {
			sql += parseWhere(options.where, params);
		}
	}

	if (options.groupBy?.length)
		sql += ` GROUP BY ${options.groupBy.map(escapeColname).join(", ")}`;
	if (options.having) sql += ` HAVING ${options.having}`;
	if (options.order?.length)
		sql += ` ORDER BY ${options.order
			.map(([col, dir]) => `${escapeColname(col)} ${dir}`)
			.join(", ")}`;

	if (options.limit !== undefined) sql += ` LIMIT ${options.limit}`;
	if (options.offset !== undefined) sql += ` OFFSET ${options.offset}`;

	if (options.union?.length) {
		for (const { type, query } of options.union) {
			sql += ` ${type} ${query}`;
		}
	}

	if (options.window) sql += ` WINDOW ${options.window}`;
	if (options.search) {
		sql += ` /* SEARCH: ${options.search} */`;
	}
	if (options.explain) {
		sql = `EXPLAIN ${sql}`;
	}

	yield { sql, params };
}
