import { escapeColname } from "./escape.js";
import { Op } from "./operators.js";

export function parseWhere(w, values) {
	const clauses = [];

	for (const [key, val] of Object.entries(w)) {
		if (key === Op.or.description && Array.isArray(val)) {
			clauses.push(`(${val.map(v => parseWhere(v, values)).join(" OR ")})`);
		} else if (key === Op.and.description && Array.isArray(val)) {
			clauses.push(`(${val.map(v => parseWhere(v, values)).join(" AND ")})`);
		} else if (typeof val === "object" && val !== null) {
			if ("json" in val) {
				const [path, value] = val.json;
				clauses.push(`json_extract(${escapeColname(key)}, '$.${path}') = ?`);
				values.push(value);
			} else if ("literal" in val) {
				clauses.push(val.literal);
			} else if ("__col__" in val) {
				clauses.push(`${escapeColname(key)} = ${val.__col__}`);
			} else if ("__fn__" in val) {
				const { __fn__, args } = val;
				const formattedArgs = args.map(arg =>
					typeof arg === "string" ? `'${arg}'` : arg
				);
				clauses.push(
					`${escapeColname(key)} = ${__fn__}(${formattedArgs.join(", ")})`
				);
			} else if (val[Op.lt]) {
				clauses.push(`${escapeColname(key)} < ?`);
				values.push(val[Op.lt]);
			} else if (val[Op.lte]) {
				clauses.push(`${escapeColname(key)} <= ?`);
				values.push(val[Op.lte]);
			} else if (val[Op.gt]) {
				clauses.push(`${escapeColname(key)} > ?`);
				values.push(val[Op.gt]);
			} else if (val[Op.gte]) {
				clauses.push(`${escapeColname(key)} >= ?`);
				values.push(val[Op.gte]);
			} else if (val[Op.ne]) {
				clauses.push(`${escapeColname(key)} != ?`);
				values.push(val[Op.ne]);
			} else if (val[Op.eq] !== undefined) {
				if (val[Op.eq] === null) {
					clauses.push(`${escapeColname(key)} IS NULL`);
				} else {
					clauses.push(`${escapeColname(key)} = ?`);
					values.push(val[Op.eq]);
				}
			} else if (val[Op.in] && Array.isArray(val[Op.in])) {
				clauses.push(
					`${escapeColname(key)} IN (${val[Op.in].map(() => "?").join(", ")})`
				);
				values.push(...val[Op.in]);
			} else if (val[Op.notIn] && Array.isArray(val[Op.notIn])) {
				clauses.push(
					`${escapeColname(key)} NOT IN (${val[Op.notIn].map(() => "?").join(", ")})`
				);
				values.push(...val[Op.notIn]);
			} else if (val[Op.like]) {
				clauses.push(`${escapeColname(key)} LIKE ?`);
				values.push(val[Op.like]);
			} else if (val[Op.notLike]) {
				clauses.push(`${escapeColname(key)} NOT LIKE ?`);
				values.push(val[Op.notLike]);
			} else if (val[Op.is] !== undefined) {
				clauses.push(
					`${escapeColname(key)} IS ${val[Op.is] === null ? "NULL" : "NOT NULL"}`
				);
			} else {
				if (val === null) {
					clauses.push(`${escapeColname(key)} IS NULL`);
				} else {
					clauses.push(`${escapeColname(key)} = ?`);
					values.push(val);
				}
			}
		} else {
			if (val === null) {
				clauses.push(`${escapeColname(key)} IS NULL`);
			} else {
				clauses.push(`${escapeColname(key)} = ?`);
				values.push(val);
			}
		}
	}

	return clauses.join(" AND ");
}
