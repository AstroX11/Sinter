export function mapDataTypeToSQLiteType(dataType) {
	switch (dataType) {
		case "INTEGER":
		case "BIGINT":
		case "BOOLEAN":
			return "INTEGER";
		case "REAL":
		case "NUMERIC":
		case "DECIMAL":
			return "REAL";
		case "STRING":
		case "TEXT":
		case "ENUM":
		case "UUID":
		case "JSON":
		case "ARRAY":
			return "TEXT";
		case "BLOB":
			return "BLOB";
		case "DATE":
		case "DATETIME":
			return "INTEGER";
		default:
			return "TEXT";
	}
}

export function convertValueToDataType(value, dataType, enumValues = []) {
	if (value === undefined || value === null) {
		return dataType === "NULL" ? null : value;
	}

	switch (dataType) {
		case "INTEGER":
			return Number.isFinite(parseInt(String(value)))
				? parseInt(String(value))
				: 0;
		case "REAL":
		case "NUMERIC":
		case "DECIMAL":
			return Number.isFinite(parseFloat(String(value)))
				? parseFloat(String(value))
				: 0.0;
		case "TEXT":
		case "STRING":
		case "UUID":
			return String(value);
		case "ENUM":
			return enumValues.includes(String(value))
				? String(value)
				: enumValues.length > 0
				? enumValues[0]
				: null;
		case "BLOB":
			return value instanceof Buffer ? value : Buffer.from(JSON.stringify(value));
		case "BOOLEAN":
			return Boolean(value) ? 1 : 0;
		case "DATE":
		case "DATETIME":
			const parsedDate = new Date(String(value));
			return Number.isFinite(parsedDate.getTime()) ? parsedDate.getTime() : null;
		case "JSON":
			return JSON.stringify(value);
		case "ARRAY":
			return JSON.stringify(value);
		case "NULL":
			return null;
		default:
			return String(value);
	}
}
