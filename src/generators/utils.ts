import { DataTypesValues } from '../index.mjs';
import { ColumnDefinition, ModelAttributes } from '../Types.mjs';

export function snakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export function mapDataType(sequelizeType: DataTypesValues | ColumnDefinition): string {
  return typeof sequelizeType === 'object' &&
    sequelizeType !== null &&
    'key' in sequelizeType &&
    typeof sequelizeType.key === 'string'
    ? mapDataTypeString(sequelizeType.key)
    : typeof sequelizeType === 'object' && sequelizeType !== null
    ? 'TEXT'
    : mapDataTypeString(sequelizeType);
}

function mapDataTypeString(typeStr: string): string {
  return typeof typeStr !== 'string'
    ? 'TEXT'
    : {
        STRING: 'TEXT',
        CHAR: 'TEXT',
        TEXT: 'TEXT',
        CITEXT: 'TEXT',
        VARCHAR: 'TEXT',
        UUID: 'TEXT',
        ENUM: 'TEXT',
        INTEGER: 'INTEGER',
        BIGINT: 'INTEGER',
        SMALLINT: 'INTEGER',
        MEDIUMINT: 'INTEGER',
        TINYINT: 'INTEGER',
        INT: 'INTEGER',
        BOOLEAN: 'INTEGER',
        FLOAT: 'REAL',
        DOUBLE: 'REAL',
        DECIMAL: 'REAL',
        REAL: 'REAL',
        DATE: 'TEXT',
        DATEONLY: 'TEXT',
        TIME: 'TEXT',
        DATETIME: 'TEXT',
        TIMESTAMP: 'TEXT',
        JSON: 'TEXT',
        JSONB: 'TEXT',
        BLOB: 'BLOB',
        BINARY: 'BLOB',
        NUMERIC: 'NUMERIC',
      }[typeStr.toUpperCase()] || 'TEXT';
}

export function formatDefaultValue(value: unknown): string {
  return value === null
    ? 'NULL'
    : typeof value === 'string'
    ? `'${value.replace(/'/g, "''")}'`
    : typeof value === 'boolean'
    ? value
      ? '1'
      : '0'
    : value instanceof Date
    ? `'${value.toISOString()}'`
    : typeof value === 'object'
    ? `'${(JSON.stringify(value) || '').replace(/'/g, "''")}'`
    : String(value);
}

export function validateIdentifier(identifier: string): string {
  if (!identifier) throw new Error('Identifier cannot be empty');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier))
    throw new Error(`Invalid SQLite identifier: ${identifier}`);
  return identifier;
}

export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function hasIntegerPrimaryKey(model: Record<string, any>): boolean {
  for (const [_, attr] of Object.entries(model.attributes) as [string, ModelAttributes][])
    if (attr.primaryKey && (mapDataType(attr.type) === 'INTEGER' || attr.autoIncrement))
      return true;
  return false;
}

export function pluralize(str: string): string {
  return str.endsWith('y')
    ? str.slice(0, -1) + 'ies'
    : /[sxz]$|([^aeiou])[h]$/i.test(str)
    ? str + 'es'
    : str + 's';
}
