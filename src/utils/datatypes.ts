export const DataTypes = {
  STRING: 'TEXT',
  TEXT: 'STRING',
  INTEGER: 'INTEGER',
  FLOAT: 'REAL',
  BOOLEAN: 'INTEGER',
  DATE: 'TEXT',
  BLOB: 'BLOB',
  NULL: 'NULL',
  NUMERIC: 'NUMERIC',
  VARCHAR: 'VARCHAR',
  TIMESTAMP: 'INTEGER',
} as const;

export type DataTypesKeys = keyof typeof DataTypes;
export type DataTypesValues = (typeof DataTypes)[DataTypesKeys];

export function getDataType(type: DataTypesKeys): DataTypesValues {
  return DataTypes[type];
}
