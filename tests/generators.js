import {
	Quantava,
	queryGenerator,
	columnGenerator,
	foreignKeysGenerator,
	indexesGenerator,
	constraintsGenerator,
	triggersGenerator,
	viewsGenerator,
	hooksGenerator,
	computedPropertiesGenerator,
	queryOptionsGenerator,
} from "quantava";

const db = new Quantava({});

const postModelDefinition = {
	name: "Post",
	tableName: "posts",
	columns: {
		id: {
			type: "INTEGER",
			primaryKey: true,
			autoIncrement: true,
			comment: "Post ID",
		},
		title: { type: "VARCHAR", length: 255, required: true },
	},
};

const modelDefinition = {
	name: "User",
	tableName: "users",
	columns: {
		id: {
			type: "INTEGER",
			primaryKey: true,
			autoIncrement: true,
			comment: "User ID",
		},
		name: {
			type: "VARCHAR",
			length: 255,
			required: true,
			enumValues: ["Alice", "Bob"],
			index: true,
		},
		balance: { type: "DECIMAL", precision: 10, scale: 2, defaultValue: 0.0 },
		userId: {
			type: "INTEGER",
			foreignKey: { table: "posts", column: "id", comment: "Reference to post" },
		},
	},
	relationships: [
		{
			type: "one-to-many",
			targetModel: "posts",
			foreignKey: "userId",
			constraintName: "fk_user_posts",
			comment: "User-Post link",
		},
	],
	indexes: [
		{
			name: "idx_user_name",
			table: "users",
			columns: ["name"],
			unique: true,
			where: "name IS NOT NULL",
		},
	],

	constraints: [
		{ name: "chk_balance", type: "check", expression: "balance >= 0" },
	],
	triggers: [
		{
			name: "trig_user_update",
			timing: "AFTER",
			event: "UPDATE",
			table: "users",
			statement: 'INSERT INTO audit_log (action) VALUES ("User updated")',
		},
	],
	views: [
		{
			name: "active_users",
			select: "SELECT id, name FROM users WHERE balance > 0",
			materialized: true,
		},
	],
	beforeInsert: data => ({ ...data, name: data.name.toUpperCase() }),
	computedProperties: [
		{
			name: "name_length",
			dependencies: ["name"],
			expression: "LENGTH(name)",
			stored: true,
		},
	],
	queryOptions: {
		select: ["id", "name"],
		from: "users",
		where: { balance: 100 },
		whereParams: { balance: 100 },
		order: [["name", "ASC"]],
		limit: 10,
	},
};

// Test 1: Create posts table
const postTableSqlParts = [...columnGenerator(postModelDefinition.columns)];
const postTableSql = `CREATE TABLE posts (${postTableSqlParts
	.map(part => part.sql || part)
	.join(", ")})`;
db.exec(postTableSql);
console.log("Posts table created:", postTableSql);

// Test 2: Create users table with columns, foreign keys, constraints
const tableSqlParts = [
	...columnGenerator(modelDefinition.columns),
	...foreignKeysGenerator(modelDefinition.relationships),
	...constraintsGenerator(modelDefinition.constraints),
];
const tableSql = `CREATE TABLE users (${tableSqlParts
	.map(part => part.sql || part)
	.join(", ")})`;
db.exec(tableSql);
console.log("Users table created:", tableSql);

// Test 3: Create indexes
for (const indexSql of indexesGenerator(modelDefinition.indexes)) {
	db.exec(indexSql);
	console.log("Index created:", indexSql);
}

// Test 4: Create triggers
for (const triggerSql of triggersGenerator(modelDefinition.triggers)) {
	db.exec(triggerSql);
	console.log("Trigger created:", triggerSql);
}

// Test 5: Create views
for (const viewSql of viewsGenerator(modelDefinition.views)) {
	db.exec(viewSql);
	console.log("View created:", viewSql);
}

// Test 6: Test hooks
for (const hook of hooksGenerator(
	{ beforeInsert: [modelDefinition.beforeInsert] },
	"User"
)) {
	console.log("Hook metadata:", hook);
	if (hook.hookType === "beforeInsert") {
		const data = { name: "alice" };
		const result = hook.fn(data);
		console.log("Before insert hook result:", result);
	}
}

// Test 7: Test computed properties
for (const { sql, metadata } of computedPropertiesGenerator(
	modelDefinition.computedProperties
)) {
	console.log("Computed property:", { sql, metadata });
	// Note: Computed properties are part of table creation, already included above
}

// Test 8: Test query options
for (const { sql, params } of queryOptionsGenerator(
	modelDefinition.queryOptions
)) {
	// use sql directly, no manual prefix
	console.log("Query options SQL:", sql, "Params:", params);
	const result = db.query(sql, params);
	console.log("Query result:", result);
}

// Test 9: Test queryGenerator
const queries = [
	{
		sql: "INSERT INTO users (name, balance) VALUES (?, ?)",
		params: ["Alice", 100.0],
	},
	{ sql: "SELECT * FROM users WHERE id = ?", params: [1] },
];
for (const result of queryGenerator(db, queries)) {
	console.log("Query generator result:", result);
}
