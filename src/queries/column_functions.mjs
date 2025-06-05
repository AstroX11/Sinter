import { convertValueToDataType } from "./mappers.mjs";

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @param {any} value
 * @param {object} row
 * @param {unknown} previousValue
 * @returns
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

	processed = convertValueToDataType(
		processed,
		column.type,
		column.enumValues || []
	);

	processed = enforceEnum(column, processed);
	applyValidation(column, processed);
	processed = applyTransformOut(column, processed);
	processed = applyGet(column, processed, row);

	return processed;
}

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @returns
 */
function resolveDefault(column) {
	if (column.defaultFn) {
		return column.defaultFn();
	}
	return column.defaultValue;
}

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @param {*} value
 * @returns
 */
function applyTransformIn(column, value) {
	return column.transformIn ? column.transformIn(value) : value;
}

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @param {*} value
 * @param {*} row
 * @returns
 */
function applySet(column, value, row) {
	return column.set ? column.set(value, row) : value;
}

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @param {*} value
 * @returns
 */
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

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @param {*} value
 */
function applyValidation(column, value) {
	if (column.validate) {
		const result = column.validate(value);
		if (result !== true) {
			throw new Error(typeof result === "string" ? result : `Validation failed`);
		}
	}
}

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @param {*} value
 * @returns
 */
function applyTransformOut(column, value) {
	return column.transformOut ? column.transformOut(value) : value;
}

/**
 *
 * @param {import("../index.mjs").ColumnDefinition} column
 * @param {*} value
 * @param {*} row
 * @returns
 */
function applyGet(column, value, row) {
	return column.get ? column.get(value, row) : value;
}

/**
 *
 * @param {import("../index.mjs").	ModelDefinition['columns']} columns
 * @param {*} row
 * @param {*} previousRow
 * @returns
 */
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
