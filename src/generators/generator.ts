import { ModelDefinition, IndexDefinition } from '../Types.mjs';

/**
 * Generates SQLite CREATE INDEX statements from a model definition
 * @param def The model definition object
 * @returns An array of CREATE INDEX statements
 */
export function generateIndexSQL(def: ModelDefinition): string[] {
  const indexStatements: string[] = [];
  if (!def.options?.indexes || !Array.isArray(def.options.indexes)) return indexStatements;
  for (const idx of def.options.indexes)
    if (idx.fields && idx.fields.length > 0)
      indexStatements.push(buildIndexSQL(def.tableName, idx) || '');
  return indexStatements;
}

/**
 * Builds a single CREATE INDEX statement
 * @param tableName The table name
 * @param idx The index definition object
 * @returns A CREATE INDEX statement
 */
function buildIndexSQL(tableName: string, idx: IndexDefinition): string {
  const unique = idx.unique ? 'UNIQUE ' : '',
    ifNotExists = idx.ifNotExists ? 'IF NOT EXISTS ' : '',
    name = idx.name || generateIndexName(tableName, idx),
    fieldDefs = processIndexFields(idx.fields);
  return idx.where
    ? `CREATE ${unique}INDEX ${ifNotExists}${name} ON ${tableName} (${fieldDefs}) WHERE ${idx.where}`
    : `CREATE ${unique}INDEX ${ifNotExists}${name} ON ${tableName} (${fieldDefs})`;
}

/**
 * Process index fields to handle expressions and ordering
 * @param fields Array of field definitions
 * @returns Comma-separated string of field definitions
 */
function processIndexFields(
  fields: Array<string | { name: string; order?: string; collate?: string; expression?: boolean }>,
): string {
  return fields
    .map((field) =>
      typeof field === 'string'
        ? field
        : `${field.expression ? field.name : `"${field.name}"`}${
            field.collate ? ` COLLATE ${field.collate}` : ''
          }${field.order ? ` ${field.order.toUpperCase()}` : ''}`,
    )
    .join(', ');
}

/**
 * Generates a name for an index based on table and fields
 * @param tableName The table name
 * @param idx The index definition
 * @returns A generated index name
 */
function generateIndexName(tableName: string, idx: IndexDefinition): string {
  return `${idx.unique ? 'unique' : 'idx'}_${tableName}_${idx.fields
    .map((f) => (typeof f === 'string' ? f : f.name))
    .join('_')
    .replace(/[^\w]/g, '_')
    .slice(0, 50)}`.toLowerCase();
}
