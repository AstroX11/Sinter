import Quantava, { DataTypes } from "quantava";

const database = new Quantava({
	filename: "database.db",
	walAutoCheckpoint: 9000,
	journalMode: "wal",
	verbose: (m, info) => {
		console.log(`MSG: ${m}\nDEBUG: ${info}`);
	},
	synchronous: "off",
	cacheSize: 3000,
	pageSize: 4096,
	foreignKeys: true,
});

const User = database.define("users", {
	id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
	username: { type: DataTypes.STRING, allowNull: false, unique: true },
	email: { type: DataTypes.STRING, allowNull: false, unique: true },
	createdAt: {
		type: DataTypes.DATE,
		defaultValue: () => new Date().toISOString(),
	},
});

const Post = database.define("posts", {
	id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
	userId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: "users",
			key: "id",
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE",
	},
	title: { type: DataTypes.STRING, allowNull: false },
	body: { type: DataTypes.TEXT, allowNull: false },
});
