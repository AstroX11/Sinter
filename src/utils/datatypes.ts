export const DATATYPE = {
    STRING: 'TEXT',
    INTEGER: 'INTEGER',
    FLOAT: 'REAL',
    BOOLEAN: 'INTEGER',
    DATE: 'TEXT',
    BLOB: 'BLOB',
    NULL: 'NULL',
    NUMERIC: 'NUMERIC',
    VARCHAR: 'VARCHAR',
    TIMESTAMP: 'TIMESTAMP',
    DATETIME: 'DATETIME'
} as const;

export type SQLiteDataTypeKeys = keyof typeof DATATYPE;
export type SQLiteDataTypeValues = typeof DATATYPE[SQLiteDataTypeKeys];

export function getDataType(type: SQLiteDataTypeKeys): SQLiteDataTypeValues {
    return DATATYPE[type];
}