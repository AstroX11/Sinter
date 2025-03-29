import { ColumnDefinition, DataType, ModelAttributes } from '../Types.mjs';

/**
 * Converts a string from camelCase to snake_case
 *
 * @param str The string to convert
 * @returns The converted string in snake_case
 */
export function snakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Maps a data type to its SQLite equivalent
 *
 * @param sequelizeType The data type to map
 * @returns The SQLite equivalent data type
 */
export function mapDataType(sequelizeType: string | DataType | ColumnDefinition): string {
  if (typeof sequelizeType === 'object' && sequelizeType !== null) {
    // Handle DataType objects
    if ('key' in sequelizeType && typeof sequelizeType.key === 'string') {
      return mapDataTypeString(sequelizeType.key);
    }
    return 'TEXT'; // Default for unknown objects
  }

  return mapDataTypeString(sequelizeType);
}

/**
 * Maps a data type string to its SQLite equivalent
 *
 * @param typeStr The data type string to map
 * @returns The SQLite equivalent data type
 */
function mapDataTypeString(typeStr: string): string {
  if (typeof typeStr !== 'string') {
    return 'TEXT';
  }

  const typeMap: Record<string, string> = {
    // Text types
    STRING: 'TEXT',
    CHAR: 'TEXT',
    TEXT: 'TEXT',
    CITEXT: 'TEXT',
    VARCHAR: 'TEXT',
    UUID: 'TEXT',
    ENUM: 'TEXT',

    // Numeric types
    INTEGER: 'INTEGER',
    BIGINT: 'INTEGER',
    SMALLINT: 'INTEGER',
    MEDIUMINT: 'INTEGER',
    TINYINT: 'INTEGER',
    INT: 'INTEGER',
    BOOLEAN: 'INTEGER', // SQLite uses 0/1 for booleans

    // Floating point types
    FLOAT: 'REAL',
    DOUBLE: 'REAL',
    DECIMAL: 'REAL',
    REAL: 'REAL',

    // Date/time types (stored as TEXT in ISO format)
    DATE: 'TEXT',
    DATEONLY: 'TEXT',
    TIME: 'TEXT',
    DATETIME: 'TEXT',
    TIMESTAMP: 'TEXT',

    // JSON types (stored as TEXT)
    JSON: 'TEXT',
    JSONB: 'TEXT',

    // Binary data
    BLOB: 'BLOB',
    BINARY: 'BLOB',

    // Other
    NUMERIC: 'NUMERIC', // Special case for exact numeric types
  };

  return typeMap[typeStr.toUpperCase()] || 'TEXT';
}

/**
 * Formats a value for use in a DEFAULT clause
 *
 * @param value The value to format
 * @returns The formatted value as a string
 */
export function formatDefaultValue(value: unknown): string {
  if (value === null) return 'NULL';

  if (typeof value === 'string') {
    // Escape single quotes for string literals
    return `'${value.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'boolean') return value ? '1' : '0';

  if (value instanceof Date) return `'${value.toISOString()}'`;

  if (typeof value === 'object') {
    // Convert objects to JSON strings
    try {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    } catch (e) {
      return 'NULL';
    }
  }

  // Numbers and other primitives
  return String(value);
}

/**
 * Validates SQLite identifiers to prevent SQL injection
 *
 * @param identifier The identifier to validate
 * @returns The validated identifier or throws an error
 */
export function validateIdentifier(identifier: string): string {
  if (!identifier) {
    throw new Error('Identifier cannot be empty');
  }

  // Check if the identifier contains only valid characters
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQLite identifier: ${identifier}`);
  }

  return identifier;
}

/**
 * Escapes and quotes an identifier if needed
 *
 * @param identifier The identifier to escape
 * @returns The escaped and quoted identifier
 */
export function escapeIdentifier(identifier: string): string {
  // SQLite identifiers are quoted with double quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function hasIntegerPrimaryKey(model: Record<string, any>): boolean {
  for (const [_, attr] of Object.entries(model.attributes) as [string, ModelAttributes][]) {
    if (attr.primaryKey && (mapDataType(attr.type) === 'INTEGER' || attr.autoIncrement)) {
      return true;
    }
  }
  return false;
}

/**
 * Converts a singular noun into its plural form using basic English pluralization rules.
 *
 * Rules:
 * - Words ending in 'y': Change 'y' to 'ies'
 * - Words ending in 's', 'x', 'z', or 'h' preceded by a non-vowel: Add 'es'
 * - All other cases: Add 's'
 *
 * @param str - The singular noun to be pluralized
 * @returns The plural form of the input string
 *
 * @example
 * pluralize('city') // returns 'cities'
 * pluralize('box') // returns 'boxes'
 * pluralize('cat') // returns 'cats'
 */
export function pluralize(str: string): string {
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  if (/[sxz]$|([^aeiou])[h]$/i.test(str)) return str + 'es';
  return str + 's';
}
