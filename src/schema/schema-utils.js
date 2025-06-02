export function resolveDefaultForSchema(column) {
	// If defaultValue is a function, don't execute it at schema time (runtime only)
	if (typeof column.defaultValue === "function") {
		// Ignore or leave out default from schema
		return undefined;
	}
	if (column.defaultValue !== undefined) {
		return column.defaultValue;
	}
	// no default or defaultFn - nothing to add at schema time
	return undefined;
}
