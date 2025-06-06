import Quantava, { DataTypes } from "quantava";

async function runTest() {
	const database = new Quantava({
		filename: "database.db",
		journalMode: "wal",
		walAutoCheckpoint: 500000,
	});

	// Define 400 tables
	const tables = Array.from({ length: 400 }, (_, i) =>
		database.define(`user_${i + 1}`, {
			id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
			username: { type: DataTypes.STRING, allowNull: false },
		})
	);

	await Promise.all(tables.map(table => table.sync()));

	// Insert 10,000 users per table (batched for control)
	const batchSize = 1000;
	for (const table of tables) {
		for (let batchStart = 1; batchStart <= 10000; batchStart += batchSize) {
			const batch = [];
			for (let i = batchStart; i < batchStart + batchSize && i <= 10000; i++) {
				batch.push({ username: `user_${i}` });
			}
			await Promise.all(batch.map(user => table.create(user)));
		}
	}

	const endTime = Date.now() + 30000;

	// Each table runs its own async loop of mixed operations with "event" simulation
	const runTableWorkload = async table => {
		while (Date.now() < endTime) {
			const randomId = Math.floor(Math.random() * 10000) + 1;
			const opChance = Math.random();

			try {
				if (opChance < 0.25) {
					// Create new user and simulate event
					const created = await table.create({ username: `new_user_${Date.now()}` });
					// Simulate event: created
					// e.g., if your ORM supports event emit: table.emit("created", created);
				} else if (opChance < 0.5) {
					// Update user and simulate event
					const user = await table.findOne({ where: { id: randomId } });
					if (user) {
						const updated = await user.update({ username: `updated_${Date.now()}` });
						// Simulate event: updated
					}
				} else if (opChance < 0.75) {
					// Delete user and simulate event
					const user = await table.findOne({ where: { id: randomId } });
					if (user) {
						await user.destory({ where: { user } });
					}
				} else {
					// Select user - read operation, simulate event if applicable
					await table.findOne({ where: { id: randomId } });
					// No event for read, typically
				}
			} catch {
				// Handle or ignore individual operation errors silently
			}
		}
	};

	// Launch one concurrent worker per table
	const workloadPromises = tables.map(table => runTableWorkload(table));

	await Promise.all(workloadPromises);

	database.close();
}

runTest().catch(console.error);
