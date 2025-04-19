import { DatabaseSync } from 'node:sqlite';
import type {
  Schema,
  ModelOptions,
  FieldDefinition,
  JournalMode
} from './types.js';

export function setupDatabase(db: DatabaseSync, options: { journalMode: JournalMode; busyTimeout?: number }) {
  db.exec(`PRAGMA journal_mode = ${options.journalMode}`);
  if (options.busyTimeout !== undefined) {
    db.exec(`PRAGMA busy_timeout = ${options.busyTimeout}`);
  }
}

export function setupTable(db: DatabaseSync, tableName: string, schema: Schema, options: ModelOptions) {
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

  const actualTableName = customTableName || (freezeTableName ? tableName : tableName);

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
      field: columnName = underscored ? name.replace(/([A-Z])/g, '_$1').toLowerCase() : name,
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

    let columnDef = `${columnName} ${type}`;
    if (generatedAs) {
      columnDef += ` GENERATED ALWAYS AS (${generatedAs}) ${stored ? 'STORED' : 'VIRTUAL'}`;
    } else {
      if (primaryKey) columnDef += ' PRIMARY KEY';
      if (autoIncrement) columnDef += ' AUTOINCREMENT';
      if (!allowNull) columnDef += ' NOT NULL';
      if (unique) columnDef += typeof unique === 'string' ? ` UNIQUE("${unique}")` : ' UNIQUE';
      if (defaultFn) {
        columnDef += ` DEFAULT (${defaultFn()})`;
      } else if (defaultValue !== undefined) {
        columnDef += ` DEFAULT ${JSON.stringify(defaultValue)}`;
      }
    }
    if (collation) columnDef += ` COLLATE ${collation}`;
    if (check) columnDef += ` CHECK (${check})`;
    if (references) columnDef += ` REFERENCES ${references.model}(${references.key})`;
    if (onUpdate) columnDef += ` ON UPDATE ${onUpdate}`;
    if (onDelete) columnDef += ` ON DELETE ${onDelete}`;
    if (comment) columnDef += ` /* ${comment} */`;
    return columnDef;
  });

  if (timestamps) {
    columns.push('createdAt INTEGER NOT NULL');
    columns.push('updatedAt INTEGER NOT NULL');
  }
  if (paranoid) {
    columns.push('deletedAt INTEGER');
  }
  for (const constraint of checkConstraints) {
    columns.push(`CHECK (${constraint})`);
  }

  const createTableStmt = `CREATE TABLE IF NOT EXISTS ${actualTableName} (${columns.join(', ')})`;
  db.exec(createTableStmt);

  for (const { fields, unique, where, name, collations, sortOrder, ifNotExists, expressionIndex, comment } of indexes) {
    const indexName = name || `idx_${actualTableName}_${fields.map(f => f.replace(/\W+/g, '_')).join('_')}`;

    const fieldDefs = fields.map((field, i) => {
      let def = field;
      if (expressionIndex) {
        def = field;
      } else {
        if (collations && collations[i]) def += ` COLLATE ${collations[i]}`;
        if (sortOrder && sortOrder[i]) def += ` ${sortOrder[i]}`;
      }
      return def;
    }).join(', ');

    let indexStmt = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${ifNotExists ? 'IF NOT EXISTS ' : ''}${indexName} ON ${actualTableName} (${fieldDefs})${where ? ` WHERE ${where}` : ''}`;

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
    const viewStmt = `CREATE ${view.ifNotExists ? 'VIEW IF NOT EXISTS' : 'VIEW'} ${view.name} AS ${view.sql}`;
    db.exec(viewStmt);
  }

  // Warn if both STRICT and WITHOUT ROWID are used together
  if (strictMode && withoutRowid) {
    console.warn(`Warning: STRICT and WITHOUT ROWID cannot be used together. Only one will be applied if supported.`);
  }
}
