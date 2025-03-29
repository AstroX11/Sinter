// index-generator.ts
import { ModelDefinition, IndexDefinition } from '../Types.mjs';

/**
 * Generates SQLite CREATE INDEX statements from a model definition
 *
 * @param def The model definition object
 * @returns An array of CREATE INDEX statements
 */
export function generateIndexSQL(def: ModelDefinition): string[] {
  const indexStatements: string[] = [];

  if (!def.options?.indexes || !Array.isArray(def.options.indexes)) {
    return indexStatements;
  }

  for (const idx of def.options.indexes) {
    if (!idx.fields || idx.fields.length === 0) {
      continue;
    }

    const indexSQL = buildIndexSQL(def.tableName, idx);
    if (indexSQL) {
      indexStatements.push(indexSQL);
    }
  }

  return indexStatements;
}

/**
 * Builds a single CREATE INDEX statement
 *
 * @param tableName The table name
 * @param idx The index definition object
 * @returns A CREATE INDEX statement
 */
function buildIndexSQL(tableName: string, idx: IndexDefinition): string {
  const unique = idx.unique ? 'UNIQUE ' : '';
  const ifNotExists = idx.ifNotExists ? 'IF NOT EXISTS ' : '';

  // Generate index name if not provided
  const name = idx.name || generateIndexName(tableName, idx);

  // Process fields to handle expressions and collations
  const fieldDefs = processIndexFields(idx.fields);

  // Build the CREATE INDEX statement
  let sql = `CREATE ${unique}INDEX ${ifNotExists}${name} ON ${tableName} (${fieldDefs})`;

  // Add WHERE clause if provided
  if (idx.where) {
    sql += ` WHERE ${idx.where}`;
  }

  return sql;
}

/**
 * Process index fields to handle expressions and ordering
 *
 * @param fields Array of field definitions
 * @returns Comma-separated string of field definitions
 */
function processIndexFields(
  fields: Array<string | { name: string; order?: string; collate?: string; expression?: boolean }>,
): string {
  return fields
    .map((field) => {
      if (typeof field === 'string') {
        return field;
      }

      let fieldDef = field.expression ? field.name : `"${field.name}"`;

      if (field.collate) {
        fieldDef += ` COLLATE ${field.collate}`;
      }

      if (field.order) {
        fieldDef += ` ${field.order.toUpperCase()}`;
      }

      return fieldDef;
    })
    .join(', ');
}

/**
 * Generates a name for an index based on table and fields
 *
 * @param tableName The table name
 * @param idx The index definition
 * @returns A generated index name
 */
function generateIndexName(tableName: string, idx: IndexDefinition): string {
  // Format fields to create a concise name
  const fieldPart = idx.fields
    .map((f) => (typeof f === 'string' ? f : f.name))
    .join('_')
    .replace(/[^\w]/g, '_')
    .slice(0, 50); // Prevent extremely long names

  const typePart = idx.unique ? 'unique' : 'idx';

  return `${typePart}_${tableName}_${fieldPart}`.toLowerCase();
}
