import { DataTypesValues } from '../index.mjs';

export function convertToSqliteValue(value: any, type: string | DataTypesValues): any {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}
