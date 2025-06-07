import Qunatava, { DataTypes } from "quantava";

const db = new Qunatava({});
const User = db.define(
	"user",
	{
		id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
		username: { type: DataTypes.STRING, allowNull: false },
		password: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultFn: async () => {
				return (await import("crypto")).randomUUID();
			},
		},
	},
	{
		indexes: [
			{
				table: "user",
				name: "idx_user_username",
				columns: ["username"],
				unique: true,
			},
		],
	}
);

(async () => {
	await db.sync({ force: true }); // Recreate tables

	// Generate 10,000 unique users
	const users = Array.from({ length: 10_000 }, (_, i) => ({
		username: `user_${i}`,
		password: `pass_${i}`,
	}));

	// Insert in bulk
	await User.bulkCreate(users);

	// Try to insert a duplicate user
	try {
		await User.create({
			username: "user_0", // duplicate username
			password: "another_pass",
		});
	} catch (error) {
		console.log(
			"Duplicate insert error (expected due to unique index):",
			error.message
		);
	}

	// Use the index for searching
	const targetUser = "user_9999";
	const result = await User.findOne({ where: { username: targetUser } });

	console.log("User found:", result);
})();
