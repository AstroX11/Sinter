import Quantava from "../index.mjs";
import { escapeColname } from "../utils/escape.js";
import {
	columnGenerator,
	foreignKeysGenerator,
	constraintsGenerator,
} from "./generator.mjs";

/**
 * Creates a table in the database based on the model definition.
 * @param {Quantava} db - The Quantava database instance.
 * @param {import("../index.mjs").ModelDefinition} modelDefinition - The model definition.
 * @returns {{ tableName: string, sql: string | null }} - The table name and executed SQL or null if table exists.
 */
export function createTable(db, modelDefinition) {
	const tableName =
		modelDefinition.tableName ||
		(modelDefinition.pluralizeTablename
			? `${modelDefinition.name}s`
			: modelDefinition.name
		).toLowerCase();

	const checkStmt = db.prepare(
		`SELECT name FROM sqlite_master WHERE type='table' AND name=?`
	);
	const tableExists = checkStmt.get(tableName);

	if (tableExists) {
		return { tableName, sql: null };
	}

	if (modelDefinition.computedProperties) {
		for (const prop of modelDefinition.computedProperties) {
			modelDefinition.columns[prop.name] = {
				type: prop.type || "TEXT",
				computedExpression: prop.expression,
				stored: prop.stored,
			};
		}
	}

	if (
		modelDefinition.timestamps === undefined ||
		modelDefinition.timestamps === true
	) {
		const createdAtColumn = modelDefinition.createdAtColumn || "createdAt";
		const updatedAtColumn = modelDefinition.updatedAtColumn || "updatedAt";

		if (!modelDefinition.columns[createdAtColumn]) {
			modelDefinition.columns[createdAtColumn] = {
				type: "INTEGER",
				defaultFn: () => Date.now(),
			};
		}
		if (!modelDefinition.columns[updatedAtColumn]) {
			modelDefinition.columns[updatedAtColumn] = {
				type: "INTEGER",
				defaultFn: () => Date.now(),
			};
		}
	}

	const sqlParts = [];

	for (const { sql } of columnGenerator(modelDefinition.columns)) {
		sqlParts.push(sql);
	}

	if (modelDefinition.relationships) {
		for (const fk of foreignKeysGenerator(modelDefinition.relationships)) {
			sqlParts.push(fk);
		}
	}

	if (modelDefinition.constraints) {
		for (const constraint of constraintsGenerator(
			modelDefinition.constraints
		)) {
			sqlParts.push(constraint);
		}
	}

	let sql = `CREATE TABLE ${escapeColname(tableName)} (${sqlParts.join(", ")})`;

	if (modelDefinition.withoutRowid) sql += " WITHOUT ROWID";
	if (modelDefinition.strict) sql += " STRICT";

	db.exec(sql);

	return { tableName, sql };
}
