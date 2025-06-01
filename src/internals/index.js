import { randomUUID } from "node:crypto";

export function registerSqliteFunctions(db) {
	db.function("uuid_generate_v4", () => randomUUID());
}
