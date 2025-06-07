import {
	Quantava,
	DataTypes,
	createTable,
	convertValueToDataType,
} from "quantava";

const db = new Quantava({ filename: "test.db" });

const modelDefinition = {
	name: "DataTypeTest",
	tableName: "datatype_tests",
	columns: {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
			comment: "Test ID",
		},
		int_col: {
			type: DataTypes.INTEGER,
			defaultValue: 42,
			comment: "Integer column",
		},
		text_col: {
			type: DataTypes.TEXT,
			defaultValue: "default text",
			comment: "Text column",
		},
		blob_col: { type: DataTypes.BLOB, comment: "Blob column" },
		real_col: {
			type: DataTypes.REAL,
			defaultValue: 3.14,
			comment: "Real column",
		},
		numeric_col: {
			type: DataTypes.NUMERIC,
			defaultValue: 123.456,
			comment: "Numeric column",
		},
		boolean_col: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
			comment: "Boolean column",
		},
		date_col: { type: DataTypes.DATE, comment: "Date column" },
		datetime_col: {
			type: DataTypes.DATETIME,
			defaultValue: new Date("2025-06-01T12:00:00Z").getTime(),
			comment: "Datetime column",
		},

		null_col: { type: DataTypes.NULL, comment: "Null column" },
		json_col: {
			type: DataTypes.JSON,
			defaultValue: { key: "value" },
			comment: "JSON column",
		},
		uuid_col: {
			type: DataTypes.UUID,
			defaultValue: "550e8400-e29b-41d4-a716-446655440000",
			comment: "UUID column",
		},
		enum_col: {
			type: DataTypes.ENUM,
			enumValues: ["red", "green", "blue"],
			defaultValue: "red",
			comment: "Enum column",
		},
		decimal_col: {
			type: DataTypes.DECIMAL,
			precision: 10,
			scale: 2,
			defaultValue: 99.99,
			comment: "Decimal column",
		},
		string_col: {
			type: DataTypes.STRING,
			length: 255,
			defaultValue: "hello",
			comment: "String column",
		},
		array_col: {
			type: DataTypes.ARRAY,
			defaultValue: ["a", "b", "c"],
			comment: "Array column",
		},
	},
	strict: true,
	comment: "Table for testing all DataTypes",
};

const { tableName, sql } = createTable(db, modelDefinition);
console.log(`Created ${tableName}: ${sql}`);

// Test 2: Verify table structure
const tableInfo = db.query("PRAGMA table_info(datatype_tests)");
console.log("Table structure:", tableInfo.rows);

// Test 3: Insert data with converted values
const testData = {
	int_col: convertValueToDataType("100", DataTypes.INTEGER),
	text_col: convertValueToDataType("sample text", DataTypes.TEXT),
	blob_col: convertValueToDataType(Buffer.from("binary"), DataTypes.BLOB),
	real_col: convertValueToDataType("2.718", DataTypes.REAL),
	numeric_col: convertValueToDataType("789.012", DataTypes.NUMERIC),
	boolean_col: convertValueToDataType(false, DataTypes.BOOLEAN),
	date_col: convertValueToDataType("2025-06-01", DataTypes.DATE),
	datetime_col: convertValueToDataType(
		"2025-06-01T14:30:00Z",
		DataTypes.DATETIME
	),
	null_col: convertValueToDataType(null, DataTypes.NULL),
	json_col: convertValueToDataType({ foo: "bar" }, DataTypes.JSON),
	uuid_col: convertValueToDataType(
		"123e4567-e89b-12d3-a456-426614174000",
		DataTypes.UUID
	),
	enum_col: convertValueToDataType("green", DataTypes.ENUM),
	decimal_col: convertValueToDataType("123.45", DataTypes.DECIMAL),
	string_col: convertValueToDataType("test string", DataTypes.STRING),
	array_col: convertValueToDataType(["x", "y", "z"], DataTypes.ARRAY),
};

const columns = Object.keys(testData).join(", ");
const placeholders = Object.keys(testData)
	.map(() => "?")
	.join(", ");
const values = Object.values(testData);
const insertSql = `INSERT INTO datatype_tests (${columns}) VALUES (${placeholders})`;
const insertResult = db.query(insertSql, values);
console.log("Insert result:", insertResult);

// Test 4: Query and verify data
const selectResult = db.query("SELECT * FROM datatype_tests WHERE id = ?", [
	insertResult.lastInsertRowid,
]);
console.log("Selected data:", selectResult.rows);

// Test 5: Test edge cases for each DataType
const edgeCases = [
	{ col: "int_col", value: "invalid", type: DataTypes.INTEGER, expected: 0 },
	{ col: "text_col", value: 123, type: DataTypes.TEXT, expected: "123" },
	{
		col: "blob_col",
		value: "text",
		type: DataTypes.BLOB,
		expected: Buffer.from("text"),
	},
	{
		col: "real_col",
		value: "not_a_number",
		type: DataTypes.REAL,
		expected: 0.0,
	},
	{ col: "numeric_col", value: "abc", type: DataTypes.NUMERIC, expected: 0.0 },
	{ col: "boolean_col", value: "true", type: DataTypes.BOOLEAN, expected: 1 },
	{
		col: "date_col",
		value: "invalid_date",
		type: DataTypes.DATE,
		expected: "Invalid Date",
	},
	{
		col: "datetime_col",
		value: "2025-06-01",
		type: DataTypes.DATETIME,
		expected: "2025-06-01T00:00:00.000Z",
	},
	{ col: "null_col", value: "something", type: DataTypes.NULL, expected: null },
	{ col: "json_col", value: null, type: DataTypes.JSON, expected: "null" },
	{ col: "uuid_col", value: 123, type: DataTypes.UUID, expected: "123" },
	{
		col: "enum_col",
		value: "invalid",
		type: DataTypes.ENUM,
		expected: "invalid",
	},
	{ col: "decimal_col", value: "abc", type: DataTypes.DECIMAL, expected: 0.0 },
	{ col: "string_col", value: null, type: DataTypes.STRING, expected: "null" },
	{
		col: "array_col",
		value: "not_array",
		type: DataTypes.ARRAY,
		expected: "not_array",
	},
];

for (const { col, value, type, expected } of edgeCases) {
	// Get enumValues from modelDefinition if this column is ENUM
	const enumValues =
		type === DataTypes.ENUM && modelDefinition.columns[col].enumValues
			? modelDefinition.columns[col].enumValues
			: [];

	const converted = convertValueToDataType(value, type, enumValues);

	const insertEdge = db.query(
		`INSERT INTO datatype_tests (${col}) VALUES (?)`,
		[converted]
	);
	const selectEdge = db.query(
		`SELECT ${col} FROM datatype_tests WHERE id = ?`,
		[insertEdge.lastInsertRowid]
	);
	const result = selectEdge.rows[0][col];
	const isEqual =
		type === DataTypes.BLOB
			? result.equals(expected)
			: type === DataTypes.DATE && expected === "Invalid Date"
			? isNaN(new Date(result).getTime())
			: JSON.stringify(result) === JSON.stringify(expected);
	console.log(`Edge case for ${col} (${type}):`, {
		input: value,
		converted,
		result,
		expected,
		pass: isEqual,
	});
}
