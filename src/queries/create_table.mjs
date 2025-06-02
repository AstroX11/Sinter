import { escapeColname } from "../utils/escape.js";
import {
	columnGenerator,
	foreignKeysGenerator,
	constraintsGenerator,
} from "./generator.mjs";

export function createTable(db, modelDefinition) {
	const tableName =
		modelDefinition.tableName ||
		(modelDefinition.pluralizeTablename
			? `${modelDefinition.name}s`
			: modelDefinition.name
		).toLowerCase();

	if (modelDefinition.computedProperties) {
		for (const prop of modelDefinition.computedProperties) {
			modelDefinition.columns[prop.name] = {
				type: prop.type || "TEXT",
				computedExpression: prop.expression,
				stored: prop.stored,
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
		for (const constraint of constraintsGenerator(modelDefinition.constraints)) {
			sqlParts.push(constraint);
		}
	}

	let sql = `CREATE TABLE ${escapeColname(tableName)} (${sqlParts.join(", ")})`;

	if (modelDefinition.withoutRowid) sql += " WITHOUT ROWID";
	if (modelDefinition.strict) sql += " STRICT";
	
	db.exec(sql);



	return { tableName, sql };
}
