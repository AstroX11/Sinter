import { DatabaseSync } from 'node:sqlite';
import type {
  ModelDefinition,
  ColumnDefinition,
  ModelAttributes,
  ValidationResult,
  DefineModelOptions,
} from '../Types.mjs';
import { pluralize } from './utils.js';
import { generateIndexSQL } from './generator.js';

export function validateIndex(db: DatabaseSync, indexName: string): boolean {
  try {
    const result = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
      .get(indexName);
    return !!result;
  } catch (error) {
    console.error(
      `Failed to validate index ${indexName}:`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export function createIndexes(db: DatabaseSync, def: ModelDefinition): void {
  if (!db) throw new Error('Database instance is required');
  if (!def?.tableName) throw new Error('Model definition requires a tableName');

  const indexSQLs = generateIndexSQL(def);

  for (const sql of indexSQLs) {
    try {
      db.exec(sql);
      const indexName = sql.match(/CREATE\s+INDEX\s+([^\s]+)/i)?.[1];
      if (indexName && !validateIndex(db, indexName)) {
        console.warn(`Index ${indexName} was not created successfully`);
      }
    } catch (error) {
      console.error(
        `Failed to create index: ${sql}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export function addTimestamps(def: ModelDefinition): void {
  if (def?.options?.timestamps) {
    def.attributes.createdAt = {
      type: 'INTEGER',
      allowNull: false,
      defaultValue: Date.now(),
    };
    def.attributes.updatedAt = {
      type: 'INTEGER',
      allowNull: false,
      defaultValue: Date.now(),
    };
  }
}

export function addParanoidField(def: ModelDefinition): void {
  if (def?.options?.paranoid) {
    def.attributes.deletedAt = {
      type: 'INTEGER',
      allowNull: true,
    };
  }
}

export function getTableName(modelName: string, options: DefineModelOptions): string {
  if (options?.tableName) {
    return options?.freezeTableName ? options.tableName : pluralize(options.tableName);
  }
  return options?.freezeTableName ? modelName : pluralize(modelName);
}

export function validateModelAttributes(modelName: string, attributes: ModelAttributes): void {
  const errors: string[] = [];
  for (const [attrName, columnDef] of Object.entries(attributes)) {
    if (!columnDef.validate) continue;
    if (columnDef.defaultValue !== undefined) {
      const result = validateValue(columnDef.defaultValue, columnDef);
      if (!result.valid)
        errors.push(
          `[${modelName}.${attrName}] Default value validation failed: ${result.errors.join(', ')}`,
        );
      if (
        (columnDef.type === 'STRING' || columnDef.type === 'TEXT') &&
        typeof columnDef.validate === 'object' &&
        'len' in columnDef.validate &&
        Array.isArray(columnDef.validate.len)
      ) {
        const [min, max] = columnDef.validate.len;
        const value = columnDef.defaultValue as string;
        if (typeof value === 'string' && (value.length < min || value.length > max))
          errors.push(
            `[${modelName}.${attrName}] Default value length must be between ${min} and ${max}`,
          );
      }
    }
  }
  if (errors.length > 0) throw new Error(`Model validation errors:\n- ${errors.join('\n- ')}`);
}

export function validateValue(value: unknown, columnDef: ColumnDefinition): ValidationResult {
  const errors: string[] = [];
  if (value === null || value === undefined)
    return {
      valid: columnDef.allowNull !== false,
      errors: columnDef.allowNull === false ? ['Value cannot be null'] : [],
    };
  if (!columnDef.validate || Array.isArray(columnDef.validate)) return { valid: true, errors: [] };
  const { validate } = columnDef;
  if (validate.isEmail && !(typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))
    errors.push(getValidationMessage(validate.isEmail, 'Must be a valid email'));
  if (
    validate.isUrl &&
    !(typeof value === 'string' && /^https?:\/\/[^\s/$.?#].[^\s]*$/.test(value))
  )
    errors.push(getValidationMessage(validate.isUrl, 'Must be a valid URL'));
  if (validate.isIP && !(typeof value === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(value)))
    errors.push(getValidationMessage(validate.isIP, 'Must be a valid IP address'));
  if (validate.isAlpha && !(typeof value === 'string' && /^[a-zA-Z]+$/.test(value)))
    errors.push(getValidationMessage(validate.isAlpha, 'Must contain only letters'));
  if (validate.isAlphanumeric && !(typeof value === 'string' && /^[a-zA-Z0-9]+$/.test(value)))
    errors.push(
      getValidationMessage(validate.isAlphanumeric, 'Must contain only letters and numbers'),
    );
  if (validate.isNumeric && isNaN(Number(value)))
    errors.push(getValidationMessage(validate.isNumeric, 'Must be a number'));
  if (validate.isInt && !Number.isInteger(Number(value)))
    errors.push(getValidationMessage(validate.isInt, 'Must be an integer'));
  if (validate.isFloat) {
    const numValue = Number(value);
    if (isNaN(numValue) || Number.isInteger(numValue))
      errors.push(getValidationMessage(validate.isFloat, 'Must be a float'));
  }
  if (validate.len) {
    const [min, max] = Array.isArray(validate.len) ? validate.len : [0, Infinity];
    const length =
      typeof value === 'string'
        ? value.length
        : Array.isArray(value)
        ? value.length
        : String(value).length;
    if (length < min || length > max)
      errors.push(getValidationMessage(validate.len, `Length must be between ${min} and ${max}`));
  }
  if (validate.notIn) {
    const forbiddenValues = Array.isArray(validate.notIn)
      ? validate.notIn
      : (validate.notIn as any).args || [];
    if (forbiddenValues.includes(value))
      errors.push(getValidationMessage(validate.notIn, 'Value is not allowed'));
  }
  if (validate.isIn) {
    const allowedValues = Array.isArray(validate.isIn)
      ? validate.isIn
      : (validate.isIn as any).args || [];
    if (!allowedValues.includes(value))
      errors.push(getValidationMessage(validate.isIn, 'Value is not in allowed list'));
  }
  return { valid: errors.length === 0, errors };
}

function getValidationMessage(rule: any, defaultMsg: string): string {
  return typeof rule === 'object' && rule.msg ? rule.msg : defaultMsg;
}

/**
 * Helper function to handle batch inserts
 */
export async function handleBatchInsert(
  db: DatabaseSync,
  tableName: string,
  records: Record<string, any>[],
  options: Record<string, any>,
) {
  if (!Array.isArray(records) || records.length === 0)
    throw new Error('Batch insert requires an array of records');
  const columns = Object.keys(records[0]);

  const batchTransaction = !options.transaction ? db.prepare('BEGIN TRANSACTION') : null;
  if (batchTransaction) batchTransaction.run();

  try {
    const results = [];
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    const stmt = db.prepare(insertSql);

    for (const record of records) {
      const values = columns.map((col) => record[col]);
      const result = stmt.run(...values);
      results.push({
        id: result.lastInsertRowid,
        changes: result.changes,
      });
    }

    if (batchTransaction) db.prepare('COMMIT').run();

    return {
      count: results.length,
      ids: results.map((r) => r.id),
      records: options.returnRaw ? records : undefined,
    };
  } catch (error) {
    if (batchTransaction) db.prepare('ROLLBACK').run();
    throw error;
  }
}
