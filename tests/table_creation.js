import {
	DataTypes,
	createTable,
	convertValueToDataType,
	Quantava,
} from "quantava";

const db = new Quantava({filename: 'test.db'});

const postModelDefinition = {
	name: "Post",
	tableName: "posts",
	columns: {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
			comment: "Post ID",
		},
		title: {
			type: DataTypes.STRING,
			length: 255,
			required: true,
			comment: "Post title",
		},
		content: { type: DataTypes.TEXT, defaultValue: "", comment: "Post content" },
	},
	strict: true,
	comment: "Posts table",
};

const userModelDefinition = {
	name: "User",
	tableName: "users",
	pluralizeTablename: false,
	columns: {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
			comment: "User ID",
		},
		name: {
			type: DataTypes.STRING,
			length: 255,
			required: true,
			enumValues: ["Alice", "Bob", "Charlie"],
			index: true,
			comment: "User name",
		},
		email: {
			type: DataTypes.STRING,
			length: 255,
			unique: true,
			notNull: true,
			validate: value => typeof value === "string" && value.includes("@"),
			comment: "User email",
		},
		balance: {
			type: DataTypes.DECIMAL,
			precision: 10,
			scale: 2,
			defaultValue: 0.0,
			check: "balance >= 0",
			comment: "User balance",
		},
		status: {
			type: DataTypes.ENUM,
			enumValues: ["active", "inactive"],
			defaultValue: "active",
			comment: "User status",
		},
		settings: {
			type: DataTypes.JSON,
			defaultValue: {},
			comment: "User settings",
		},
		uuid: {
			type: DataTypes.UUID,
			defaultExpression: "uuid_generate_v4()",
			comment: "Unique identifier",
		},
		createdAt: {
			type: DataTypes.DATETIME,
			defaultExpression: "CURRENT_TIMESTAMP",
			comment: "Creation timestamp",
		},
		deletedAt: {
			type: DataTypes.DATETIME,
			comment: "Deletion timestamp for soft delete",
		},
		postId: {
			type: DataTypes.INTEGER,
			foreignKey: {
				table: "posts",
				column: "id",
				onDelete: "CASCADE",
				comment: "Reference to post",
			},
			comment: "Foreign key to post",
		},
		computedScore: {
			type: DataTypes.REAL,
			generatedAs: "balance * 1.5",
			stored: true,
			comment: "Computed user score",
		},
	},
	relationships: [
		{
			type: "one-to-many",
			targetModel: "posts",
			foreignKey: "postId",
			constraintName: "fk_user_posts",
			onDelete: "CASCADE",
			comment: "User-Post link",
		},
	],
	indexes: [
		{
			name: "idx_user_name",
			columns: ["name"],
			unique: true,
			where: "name IS NOT NULL",
		},
		{
			name: "idx_user_email_status",
			columns: ["email", "status"],
			collate: "NOCASE",
			partial: true,
			where: "status = 'active'",
		},
	],
	constraints: [
		{ name: "chk_balance", type: "check", expression: "balance >= 0" },
		{ name: "chk_email", type: "check", expression: "email LIKE '%@%.%'" },
	],
	computedProperties: [
		{
			name: "name_length",
			dependencies: ["name"],
			expression: "LENGTH(name)",
			stored: true,
		},
	],
	virtualFields: {
		fullProfile: row => `${row.name} <${row.email}>`,
		isActive: row => row.status === "active",
	},
	softDelete: true,
	deletedAtColumn: "deletedAt",
	timestamps: true,
	createdAtColumn: "createdAt",
	strict: true,
	withoutRowid: false,
	comment: "Users table with comprehensive features",
};

// Test 1: Create posts table (dependency for foreign key)
const { tableName: postTableName, sql: postTableSql } = createTable(
	db,
	postModelDefinition
);
console.log(`Created ${postTableName}: ${postTableSql}`);

// Test 2: Create users table with complex features
const { tableName: userTableName, sql: userTableSql } = createTable(
	db,
	userModelDefinition
);
console.log(`Created ${userTableName}: ${userTableSql}`);

// Test 3: Verify table existence and structure
const tableInfo = db.query("PRAGMA table_info(users)");
console.log("Users table structure:", tableInfo.rows);

// Test 4: Test convertValueToDataType for all DataTypes
const testValues = [
	{ value: "123", type: DataTypes.INTEGER, expected: 123 },
	{ value: "3.14", type: DataTypes.REAL, expected: 3.14 },
	{ value: "hello", type: DataTypes.STRING, expected: "hello" },
	{ value: { key: "value" }, type: DataTypes.JSON, expected: '{"key":"value"}' },
	{ value: true, type: DataTypes.BOOLEAN, expected: 1 },
	{
		value: "2025-06-01",
		type: DataTypes.DATE,
		expected: "2025-06-01T00:00:00.000Z",
	},
	{ value: ["a", "b"], type: DataTypes.ARRAY, expected: '["a","b"]' },
	{ value: null, type: DataTypes.NULL, expected: null },
	{
		value: "550e8400-e29b-41d4-a716-446655440000",
		type: DataTypes.UUID,
		expected: "550e8400-e29b-41d4-a716-446655440000",
	},
	{ value: "active", type: DataTypes.ENUM, expected: "active" },
	{ value: "12.34", type: DataTypes.DECIMAL, expected: 12.34 },
	{
		value: Buffer.from("test"),
		type: DataTypes.BLOB,
		expected: Buffer.from("test"),
	},
];
for (const { value, type, expected } of testValues) {
	const converted = convertValueToDataType(value, type);
	const isEqual =
		type === DataTypes.BLOB
			? converted.equals(expected)
			: JSON.stringify(converted) === JSON.stringify(expected);
	console.log(`Convert ${value} to ${type}:`, {
		converted,
		expected,
		pass: isEqual,
	});
}

// Test 5: Test virtual fields
const virtualFieldResults = {
	fullProfile: userModelDefinition.virtualFields.fullProfile({
		name: "Alice",
		email: "alice@example.com",
	}),
	isActive: userModelDefinition.virtualFields.isActive({ status: "active" }),
};
console.log("Virtual fields results:", virtualFieldResults);

// Test 6: Test soft delete functionality
const insertUser = db.query(
	"INSERT INTO users (name, email, balance, status) VALUES (?, ?, ?, ?)",
	["Alice", "alice@example.com", 100.0, "active"]
);
console.log("Inserted user:", insertUser);
const softDelete = db.query(
	"UPDATE users SET deletedAt = CURRENT_TIMESTAMP WHERE id = ?",
	[1]
);
console.log("Soft deleted user:", softDelete);
const selectActive = db.query("SELECT * FROM users WHERE deletedAt IS NULL");
console.log("Active users after soft delete:", selectActive.rows);

// Test 7: Test computed properties and generated columns
const selectComputed = db.query(
	"SELECT name, name_length, computedScore FROM users WHERE name = ?",
	["Alice"]
);
console.log("Computed properties and generated columns:", selectComputed.rows);
