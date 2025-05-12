import { DatabaseSync } from 'node:sqlite';
import {
	JournalMode,
	type Schema,
	type ModelOptions,
	type FieldDefinition,
} from './types.js';
import { SQLITE_RESERVED_KEYWORDS } from './tools.js';

export function escapeSQLiteValue(value: unknown): string {
	if (typeof value === 'string') {
		return `'${value.replace(/'/g, "''")}'`;
	} else if (typeof value === 'number') {
		return value.toString();
	} else if (typeof value === 'boolean') {
		return value ? '1' : '0';
	} else if (value === null) {
		return 'NULL';
	} else {
		throw new Error(`Unsupported default value type: ${typeof value}`);
	}
}

export function setupTable(
	db: DatabaseSync,
	tableName: string,
	schema: Schema,
	options: ModelOptions,
	modelRegistry?: Map<string, { new (): any }>,
) {
	const {
		timestamps = true,
		paranoid = false,
		tableName: customTableName,
		underscored = false,
		freezeTableName = false,
		indexes = [],
		strictMode = true,
		withoutRowid = false,
		triggers = [],
		views = [],
		checkConstraints = [],
	} = options as ModelOptions & {
		triggers?: {
			name: string;
			timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
			event: 'INSERT' | 'UPDATE' | 'DELETE';
			table?: string;
			statement: string;
			condition?: string;
		}[];
		views?: {
			name: string;
			sql: string;
			ifNotExists?: boolean;
		}[];
		checkConstraints?: string[];
	};

	const actualTableName =
		customTableName || (freezeTableName ? tableName : tableName);

	const autoIndexedFields: { fieldName: string; indexName?: string }[] = [];

	const columns = Object.entries(schema).map(([name, field]) => {
		const {
			type,
			allowNull = true,
			defaultValue,
			defaultFn,
			unique,
			indexed,
			primaryKey,
			autoIncrement,
			generatedAs,
			stored,
			field: columnName = underscored
				? name.replace(/([A-Z])/g, '_$1').toLowerCase()
				: name,
			references,
			onUpdate,
			onDelete,
			comment,
			collation,
			check,
		} = field as FieldDefinition & {
			indexed?: boolean | string;
			generatedAs?: string;
			stored?: boolean;
			collation?: string;
			check?: string;
		};

		// Validate references and onUpdate/onDelete
		if (references && modelRegistry && !modelRegistry.has(references.model)) {
			console.warn(
				`Referenced model ${references.model} not found for field ${name} in table ${tableName}`,
			);
		}
		if ((onUpdate || onDelete) && !references) {
			throw new Error(
				`onUpdate/onDelete requires references for field ${name} in table ${tableName}`,
			);
		}

		if (indexed) {
			autoIndexedFields.push({
				fieldName: columnName,
				indexName: typeof indexed === 'string' ? indexed : undefined,
			});
		}

		const escapedColumnName = SQLITE_RESERVED_KEYWORDS.has(
			columnName.toLowerCase(),
		)
			? `"${columnName}"`
			: columnName;

		let columnDef = `${escapedColumnName} ${type}`;
		if (generatedAs) {
			columnDef += ` GENERATED ALWAYS AS (${generatedAs}) ${
				stored ? 'STORED' : 'VIRTUAL'
			}`;
		} else {
			if (primaryKey) columnDef += ' PRIMARY KEY';
			if (autoIncrement) columnDef += ' AUTOINCREMENT';
			if (!allowNull) columnDef += ' NOT NULL';
			if (unique)
				columnDef +=
					typeof unique === 'string' ? ` UNIQUE("${unique}")` : ' UNIQUE';
			if (defaultValue !== undefined) {
				columnDef += ` DEFAULT ${escapeSQLiteValue(defaultValue)}`;
			}
		}
		if (collation) columnDef += ` COLLATE ${collation}`;
		if (check) columnDef += ` CHECK (${check})`;
		if (references)
			columnDef += ` REFERENCES ${references.model}(${references.key})`;
		if (onUpdate) columnDef += ` ON UPDATE ${onUpdate}`;
		if (onDelete) columnDef += ` ON DELETE ${onDelete}`;
		if (comment) columnDef += ` /* ${comment} */`;
		return columnDef;
	});

	const hasCreatedAt = schema.hasOwnProperty('createdAt');
	const hasUpdatedAt = schema.hasOwnProperty('updatedAt');

	if (timestamps) {
		if (!hasCreatedAt) columns.push('createdAt INTEGER NOT NULL');
		if (!hasUpdatedAt) columns.push('updatedAt INTEGER NOT NULL');
	}

	if (paranoid) {
		columns.push('deletedAt INTEGER');
	}
	for (const constraint of checkConstraints) {
		columns.push(`CHECK (${constraint})`);
	}

	const createTableStmt = `CREATE TABLE IF NOT EXISTS ${actualTableName} (${columns.join(
		', ',
	)})`;
	db.exec(createTableStmt);

	for (const { fieldName, indexName } of autoIndexedFields) {
		const escapedFieldName = SQLITE_RESERVED_KEYWORDS.has(
			fieldName.toLowerCase(),
		)
			? `"${fieldName}"`
			: fieldName;
		const defaultIndexName = `idx_${actualTableName}_${fieldName.replace(
			/\W+/g,
			'_',
		)}`;
		const actualIndexName = indexName || defaultIndexName;

		const indexStmt = `CREATE INDEX IF NOT EXISTS ${actualIndexName} ON ${actualTableName} (${escapedFieldName})`;
		db.exec(indexStmt);
	}

	for (const {
		fields,
		unique,
		where,
		name,
		collations,
		sortOrder,
		ifNotExists,
		expressionIndex,
		comment,
	} of indexes) {
		const indexName =
			name ||
			`idx_${actualTableName}_${fields
				.map(f => f.replace(/\W+/g, '_'))
				.join('_')}`;

		const fieldDefs = fields
			.map((field, i) => {
				let def = SQLITE_RESERVED_KEYWORDS.has(field.toLowerCase())
					? `"${field}"`
					: field;
				if (expressionIndex) {
					def = field;
				} else {
					if (collations && collations[i]) def += ` COLLATE ${collations[i]}`;
					if (sortOrder && sortOrder[i]) def += ` ${sortOrder[i]}`;
				}
				return def;
			})
			.join(', ');

		let indexStmt = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${
			ifNotExists ? 'IF NOT EXISTS ' : ''
		}${indexName} ON ${actualTableName} (${fieldDefs})${
			where ? ` WHERE ${where}` : ''
		}`;

		if (comment) indexStmt += ` /* ${comment} */`;

		db.exec(indexStmt);
	}

	for (const trigger of triggers) {
		const triggerName = trigger.name;
		const timing = trigger.timing;
		const event = trigger.event;
		const triggerTable = trigger.table || actualTableName;
		const condition = trigger.condition ? `WHEN ${trigger.condition}` : '';
		const triggerStmt = `CREATE TRIGGER IF NOT EXISTS ${triggerName} ${timing} ${event} ON ${triggerTable} ${condition} BEGIN ${trigger.statement}; END;`;
		db.exec(triggerStmt);
	}

	for (const view of views) {
		const viewStmt = `CREATE ${
			view.ifNotExists ? 'VIEW IF NOT EXISTS' : 'VIEW'
		} ${view.name} AS ${view.sql}`;
		db.exec(viewStmt);
	}

	if (strictMode && withoutRowid) {
		console.warn(
			`Warning: STRICT and WITHOUT ROWID cannot be used together. Only one will be applied if supported.`,
		);
	}
}

export function setupDatabase(
	db: DatabaseSync,
	options: { journalMode: JournalMode; busyTimeout?: number },
) {
	db.exec(`PRAGMA journal_mode = ${options.journalMode}`);
	if (options.busyTimeout !== undefined) {
		db.exec(`PRAGMA busy_timeout = ${options.busyTimeout}`);
	}
}
