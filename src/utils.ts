import { type ORMInputValue } from "./types.js";
import { ExtendedWhereOptions, ModelOptions, Schema } from "./types.js";

export const Op = {
    lt: Symbol('lt'),
    lte: Symbol('lte'),
    gt: Symbol('gt'),
    gte: Symbol('gte'),
    ne: Symbol('ne'),
    eq: Symbol('eq'),
    in: Symbol('in'),
    notIn: Symbol('notIn'),
    like: Symbol('like'),
    notLike: Symbol('notLike'),
    is: Symbol('is'),
};

export function col(name: string) {
    return { __col__: name };
}

export function fn(name: string, ...args: any[]) {
    return { __fn__: name, args };
}

export function isORMInputValue(value: unknown): value is ORMInputValue {
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null ||
        value === undefined ||
        value instanceof Uint8Array ||
        (typeof value === 'object' && value !== null)
    );
}

export function parseWhere(w: ExtendedWhereOptions, values: ORMInputValue[]): string {
    const clauses: string[] = [];
    for (const [key, val] of Object.entries(w)) {
        if (key === 'or' && Array.isArray(val)) {
            clauses.push(`(${val.map(v => parseWhere(v, values)).join(' OR ')})`);
        } else if (key === 'and' && Array.isArray(val)) {
            clauses.push(`(${val.map(v => parseWhere(v, values)).join(' AND ')})`);
        } else if (typeof val === 'object' && val !== null) {
            if ('json' in val) {
                const [path, value] = val.json!;
                clauses.push(`json_extract(${key}, '$.${path}') = ?`);
                values.push(value);
            } else if ('literal' in val) {
                clauses.push(val.literal!);
            } else if ('__col__' in val) {
                clauses.push(`${key} = ${val.__col__}`);
            } else if ('__fn__' in val) {
                const { __fn__, args } = val as { __fn__: string; args: any[] };
                const formattedArgs = args.map((arg: any) => (typeof arg === 'string' ? `'${arg}'` : arg));
                clauses.push(`${key} = ${__fn__}(${formattedArgs.join(', ')})`);
            } else if (val[Op.lt]) {
                clauses.push(`${key} < ?`);
                values.push(val[Op.lt]);
            } else if (val[Op.lte]) {
                clauses.push(`${key} <= ?`);
                values.push(val[Op.lte]);
            } else if (val[Op.gt]) {
                clauses.push(`${key} > ?`);
                values.push(val[Op.gt]);
            } else if (val[Op.gte]) {
                clauses.push(`${key} >= ?`);
                values.push(val[Op.gte]);
            } else if (val[Op.ne]) {
                clauses.push(`${key} != ?`);
                values.push(val[Op.ne]);
            } else if (val[Op.eq]) {
                clauses.push(`${key} = ?`);
                values.push(val[Op.eq]);
            } else if (val[Op.in] && Array.isArray(val[Op.in])) {
                clauses.push(`${key} IN (${val[Op.in].map(() => '?').join(', ')})`);
                values.push(...val[Op.in]);
            } else if (val[Op.notIn] && Array.isArray(val[Op.notIn])) {
                clauses.push(`${key} NOT IN (${val[Op.notIn].map(() => '?').join(', ')})`);
                values.push(...val[Op.notIn]);
            } else if (val[Op.like]) {
                clauses.push(`${key} LIKE ?`);
                values.push(val[Op.like]);
            } else if (val[Op.notLike]) {
                clauses.push(`${key} NOT LIKE ?`);
                values.push(val[Op.notLike]);
            } else if (val[Op.is] !== undefined) {
                clauses.push(`${key} IS ${val[Op.is] === null ? 'NULL' : 'NOT NULL'}`);
            } else {
                clauses.push(`${key} = ?`);
                values.push(val);
            }
        } else {
            clauses.push(`${key} = ?`);
            values.push(val);
        }
    }
    return clauses.join(' AND ');
}

export function validateField(
    value: ORMInputValue,
    field: Schema[string],
    key: string
): void {
    if (field.validate && value != null && !(typeof value === 'object' && ('__fn__' in (value as any) || '__col__' in (value as any)))) {
        for (const [rule, validator] of Object.entries(field.validate)) {
            if (!validator(value)) throw new Error(`Validation failed for ${key}: ${rule}`);
        }
    }
}

export function transformField(
    value: ORMInputValue,
    field: Schema[string],
    setValue: (v: unknown) => void
): ORMInputValue {
    let result = value;
    if (result != null && !(typeof result === 'object' && ('__fn__' in (result as any) || '__col__' in (result as any)))) {
        if (field.transform) result = field.transform(result) as ORMInputValue;
        if (field.set) field.set(result, { value: setValue });
    }
    return result;
}

export function mapKeys(
    schema: Schema,
    options: ModelOptions,
    dataKeys: string[]
): string[] {
    const { underscored = false } = options;
    return dataKeys.map((key) =>
        schema[key]?.field ?? (underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key)
    );
}

export function processTimestampsAndParanoid(
    data: Record<string, ORMInputValue>,
    options: ModelOptions
): void {
    const { timestamps = true, paranoid = false } = options;
    const now = Date.now();

    if (timestamps) {
        data.createdAt = data.createdAt ?? now;
        data.updatedAt = data.updatedAt ?? now;
    }
    if (paranoid) {
        data.deletedAt = data.deletedAt ?? null;
    }
}

export function handleSQLFunction(
    value: ORMInputValue,
    key: string,
    underscored: boolean
): string | ORMInputValue {
    if (typeof value === 'object' && value !== null && '__fn__' in value) {
        const { __fn__, args = [] } = value as { __fn__: string; args?: any[] };
        const formattedArgs = args.map((arg: any) => (typeof arg === 'string' ? `'${arg}'` : arg));
        return `${__fn__}(${formattedArgs.join(', ')})`;
    }
    return value;
}

export function processRecordData(
    schema: Schema,
    data: Record<string, ORMInputValue>,
    options: ModelOptions
): void {
    const { underscored = false } = options;

    for (const key of Object.keys(schema)) {
        const field = schema[key];
        if (field.isVirtual) {
            delete data[key];
            continue;
        }

        if (!(key in data) || data[key] == null) {
            const raw = field.defaultFn?.() ?? field.defaultValue;
            data[key] = isORMInputValue(raw) ? raw : data[key];
        }

        data[key] = transformField(data[key], field, (v) => (data[key] = v as ORMInputValue));
        validateField(data[key], field, key);
    }
}