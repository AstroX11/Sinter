export type QunatavaOptions = {
	filename?: string;
	readonly?: boolean;
	timeout?: number;
	verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
};

export type QueryResult<T> = {
	rows: T[];
	changes: number;
	lastInsertRowid: number | bigint;
};
