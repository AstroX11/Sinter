/**
 * Configuration options for the Qunatava database connection and behavior tuning.
 */
export type QunatavaOptions = {
	/**
	 * The file path for the SQLite database.
	 *
	 * - If omitted, defaults to an in-memory database (`":memory:"`).
	 * - Persistent storage is achieved by providing a valid filesystem path.
	 * - Use of ":memory:" creates a volatile, RAM-only database that
	 *   resets on process exit.
	 */
	filename?: string;

	/**
	 * Opens the database in read-only mode when true.
	 *
	 * - Prevents any write operations or schema changes.
	 * - Useful for scenarios requiring guaranteed immutability or security.
	 * - Defaults to `false` to allow read/write access.
	 */
	readonly?: boolean;

	/**
	 * The maximum time in milliseconds to wait for the database lock before
	 * throwing a timeout error.
	 *
	 * - SQLite locks the database during writes to maintain consistency.
	 * - If the database is locked beyond this duration, operations abort.
	 * - Defaults to 5000 ms (5 seconds).
	 * - Adjust according to application concurrency and performance needs.
	 */
	timeout?: number;

	/**
	 * Optional verbose logging callback.
	 *
	 * - Called with diagnostic messages such as executed SQL statements.
	 * - Useful for debugging and profiling database interactions.
	 * - The first argument is typically a string message.
	 * - Additional arguments may provide context-specific details.
	 */
	verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;

	/**
	 * Controls SQLite's journal mode, determining how transactions are logged
	 * and how rollback is handled. Impacts durability, concurrency, and
	 * crash recovery.
	 *
	 * Allowed values:
	 * - `"off"`: Disables rollback journaling. Risks database corruption on crashes.
	 * - `"delete"`: Default mode; journal file is deleted after each transaction.
	 * - `"truncate"`: Journal file is truncated instead of deleted.
	 * - `"persist"`: Journal file persists between transactions.
	 * - `"memory"`: Journal stored in volatile RAM; faster but unsafe on crash.
	 * - `"wal"`: Write-Ahead Logging; improves concurrency and recovery.
	 *
	 * Choose mode according to your durability, performance, and concurrency requirements.
	 */
	journalMode?: "off" | "delete" | "truncate" | "persist" | "memory" | "wal";

	/**
	 * Controls the synchronous setting of SQLite, which affects how strictly
	 * the database engine waits for data to be physically written to storage.
	 *
	 * Options:
	 * - `"off"`: No synchronization; highest performance but high risk of corruption.
	 * - `"normal"`: Balanced durability and speed; default on WAL mode.
	 * - `"full"`: Full synchronization for maximum durability; default on rollback mode.
	 * - `"extra"`: Extra synchronization ensuring even higher durability guarantees.
	 *
	 * Increasing durability impacts write latency and throughput.
	 */
	synchronous?: "off" | "normal" | "full" | "extra";

	/**
	 * Sets the number of pages SQLite uses for its database cache.
	 *
	 * - Positive values specify the number of pages.
	 * - Negative values specify the size in kibibytes (KiB).
	 * - Larger cache sizes improve read performance at the cost of memory usage.
	 * - Default cache size varies by SQLite configuration.
	 */
	cacheSize?: number;

	/**
	 * Defines the size in bytes of a single database page.
	 *
	 * - Must be a power of two (commonly 1024, 2048, 4096, 8192).
	 * - Affects I/O efficiency and maximum database size.
	 * - Should be set before database creation to take effect.
	 */
	pageSize?: number;

	/**
	 * Enables or disables enforcement of foreign key constraints.
	 *
	 * - When enabled (`true`), SQLite checks foreign key relationships on
	 *   insert, update, and delete operations.
	 * - Default is `false` for backward compatibility.
	 * - Recommended to enable (`true`) to maintain referential integrity.
	 */
	foreignKeys?: boolean;

	/**
	 * Sets the interval for automatic checkpointing in Write-Ahead Logging (WAL) mode.
	 *
	 * - Value is the number of pages between checkpoints.
	 * - Checkpoints transfer WAL contents back to the main database file,
	 *   balancing performance and disk usage.
	 * - Lower values increase checkpoint frequency, reducing WAL size but
	 *   potentially impacting performance.
	 * - Higher values reduce checkpoint frequency but increase WAL file size.
	 */
	walAutoCheckpoint?: number;
};

export type QueryResult<T> = {
	rows: T[];
	changes: number;
	lastInsertRowid: number | bigint;
};
