export function safeGet(obj: any, path: string, defaultValue: any = null) {
  return path.split('.').reduce((acc, key) => {
    try {
      return acc?.[key] ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }, obj);
}

export function convertValueForSQLite(value: any): any {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

export function sanitizeInput(input: string): string {
  // Remove any characters that could be used for SQL injection
  // Only allow alphanumeric characters, underscores, and dots
  return input.replace(/[^a-zA-Z0-9_.]/g, '');
}
