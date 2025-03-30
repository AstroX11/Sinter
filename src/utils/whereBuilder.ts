// utils/whereBuilder.ts
export function buildWhereClause(where: Record<string, any>): {
    clause: string;
    values: any[];
  } {
    const conditions: string[] = [];
    const values: any[] = [];
  
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined || value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        // Handle operator objects like { gt: 5 }
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case 'eq':
              conditions.push(`${key} = ?`);
              values.push(opValue);
              break;
            case 'ne':
              conditions.push(`${key} != ?`);
              values.push(opValue);
              break;
            case 'gt':
              conditions.push(`${key} > ?`);
              values.push(opValue);
              break;
            case 'gte':
              conditions.push(`${key} >= ?`);
              values.push(opValue);
              break;
            case 'lt':
              conditions.push(`${key} < ?`);
              values.push(opValue);
              break;
            case 'lte':
              conditions.push(`${key} <= ?`);
              values.push(opValue);
              break;
            case 'in':
              if (!Array.isArray(opValue)) {
                throw new Error(`Value for 'in' operator must be an array`);
              }
              const placeholders = opValue.map(() => '?').join(', ');
              conditions.push(`${key} IN (${placeholders})`);
              values.push(...opValue);
              break;
            case 'like':
              conditions.push(`${key} LIKE ?`);
              values.push(opValue);
              break;
            default:
              throw new Error(`Unsupported operator: ${op}`);
          }
        }
      } else {
        // Simple equality
        conditions.push(`${key} = ?`);
        values.push(value);
      }
    }
  
    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    };
  }