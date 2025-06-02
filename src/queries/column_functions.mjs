/**
 * What does this do?
 * This file will contain functions
 * Made to run on the columns
 */
export function processColumnValue(column, value, row, previousValue) {
	let processed = value;

	if (processed === undefined || processed === null) {
		processed = resolveDefault(column);
	}

	if (column.required && (processed === undefined || processed === null)) {
		throw new Error(`Column "${column.name}" is required.`);
	}

	if (
		column.immutable &&
		previousValue !== undefined &&
		processed !== previousValue
	) {
		throw new Error(
			`Column "${column.name}" is immutable and cannot be changed.`
		);
	}

	processed = applyTransformIn(column, processed);
	processed = applySet(column, processed, row);
	processed = coerceAffinity(column, processed);
	processed = enforceEnum(column, processed);
	applyValidation(column, processed);
	processed = applyTransformOut(column, processed);
	processed = applyGet(column, processed, row);

	return processed;
}

function resolveDefault(column) {
	if (column.defaultFn) {
		return column.defaultFn();
	}
	return column.defaultValue;
}

function applyTransformIn(column, value) {
	return column.transformIn ? column.transformIn(value) : value;
}

function applySet(column, value, row) {
	return column.set ? column.set(value, row) : value;
}

function coerceAffinity(column, value) {
	if (value === undefined || value === null) return value;

	switch (column.affinity) {
		case "TEXT":
			return String(value);
		case "INTEGER":
			return parseInt(value, 10) || 0;
		case "REAL":
			return parseFloat(value) || 0;
		case "BLOB":
			return value;
		case "NUMERIC":
			return Number(value) || 0;
		default:
			return value;
	}
}

function enforceEnum(column, value) {
	if (column.enumValues && !column.enumValues.includes(value)) {
		throw new Error(
			`Value "${value}" is not in allowed enum values: ${column.enumValues.join(
				", "
			)}`
		);
	}
	return value;
}

function applyValidation(column, value) {
	if (column.validate) {
		const result = column.validate(value);

		if (result !== true) {
			throw new Error(typeof result === "string" ? result : `Validation failed`);
		}
	}
}

function applyTransformOut(column, value) {
	return column.transformOut ? column.transformOut(value) : value;
}

function applyGet(column, value, row) {
	return column.get ? column.get(value, row) : value;
}

export function processRow(columns, row, previousRow) {
	const output = {};
	for (const key of Object.keys(columns)) {
		const colDef = columns[key];
		const inputValue = row[key];
		const previousValue = previousRow ? previousRow[key] : undefined;
		output[key] = processColumnValue(colDef, inputValue, row, previousValue);
	}
	return output;
}
