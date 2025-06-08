export function resolveDefaultForSchema(column) {
	// If defaultValue is a function, skip evaluation at schema time
	if (typeof column.defaultValue === "function") {
		return undefined;
	}

	let value = column.defaultValue;

	if (typeof value === "object" && value !== null) {
		if (Buffer.isBuffer(value)) {
			// Convert Buffer to Uint8Array for Blob compatibility
			return new Blob([new Uint8Array(value)]);
		}
		// JSON stringify for objects/arrays
		return JSON.stringify(value);
	}

	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}

	return value !== undefined ? value : undefined;
}
