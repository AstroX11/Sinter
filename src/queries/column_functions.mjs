import { convertValueToDataType } from "./mappers.mjs";

/**
 * Processes a single column value according to its definition.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @param {any} value - The input value for the column.
 * @param {object} row - The entire row being processed.
 * @param {unknown} previousValue - The previous value of the column (for updates).
 * @param {import("../index.mjs").ModelDefinition} [modelDefinition] - The model definition (optional, for timestamp handling).
 * @returns {any} - The processed value.
 */
export function processColumnValue(
	column,
	value,
	row,
	previousValue,
	modelDefinition
) {
	let processed = value;

	// Handle updatedAt for updates when timestamps is undefined or true
	if (
		previousValue !== undefined && // Indicates an update
		(modelDefinition?.timestamps === undefined ||
			modelDefinition?.timestamps === true) &&
		column.name === (modelDefinition?.updatedAtColumn || "updatedAt")
	) {
		processed = Date.now();
	}

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
 * Resolves the default value for a column.
 * If the value is an object/array, it's JSON.stringified.
 * If it's a boolean, it's converted to 1 or 0.
 * If it's a Buffer, it's converted to a Blob.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @returns {any} - The resolved default value.
 */
function resolveDefault(column) {
	let value = column.defaultFn ? column.defaultFn() : column.defaultValue;

	if (typeof value === "object" && value !== null) {
		// Buffer handling
		if (Buffer.isBuffer(value)) {
			// Convert Buffer to Uint8Array for Blob compatibility
			return new Blob([new Uint8Array(value)]);
		}
		// JSON handling for objects and arrays
		return JSON.stringify(value);
	}

	// Boolean handling
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}

	return value;
}

/**
 * Applies the transformIn function to a value.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @param {*} value - The input value.
 * @returns {*} - The transformed value.
 */
function applyTransformIn(column, value) {
	return column.transformIn ? column.transformIn(value) : value;
}

/**
 * Applies the set function to a value.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @param {*} value - The input value.
 * @param {*} row - The row being processed.
 * @returns {*} - The set value.
 */
function applySet(column, value, row) {
	return column.set ? column.set(value, row) : value;
}

/**
 * Enforces enum values for a column.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @param {*} value - The input value.
 * @returns {*} - The validated value.
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
 * Applies validation to a column value.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @param {*} value - The input value.
 */
function applyValidation(column, value) {
	if (column.validate) {
		const result = column.validate(value);
		if (result !== true) {
			throw new Error(
				typeof result === "string" ? result : `Validation failed`
			);
		}
	}
}

/**
 * Applies the transformOut function to a value.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @param {*} value - The input value.
 * @returns {*} - The transformed value.
 */
function applyTransformOut(column, value) {
	return column.transformOut ? column.transformOut(value) : value;
}

/**
 * Applies the get function to a value.
 * @param {import("../index.mjs").ColumnDefinition} column - The column definition.
 * @param {*} value - The input value.
 * @param {*} row - The row being processed.
 * @returns {*} - The retrieved value.
 */
function applyGet(column, value, row) {
	return column.get ? column.get(value, row) : value;
}

/**
 * Processes an entire row according to its column definitions.
 * @param {import("../index.mjs").ModelDefinition['columns']} columns - The column definitions.
 * @param {*} row - The input row to process.
 * @param {*} previousRow - The previous row (for updates).
 * @param {import("../index.mjs").ModelDefinition} [modelDefinition] - The model definition (optional, for timestamp handling).
 * @returns {Object} - The processed row.
 */
export function processRow(columns, row, previousRow, modelDefinition) {
	const output = {};
	for (const key of Object.keys(columns)) {
		const colDef = columns[key];
		const inputValue = row[key];
		const previousValue = previousRow ? previousRow[key] : undefined;
		output[key] = processColumnValue(
			colDef,
			inputValue,
			row,
			previousValue,
			modelDefinition
		);
	}
	return output;
}
