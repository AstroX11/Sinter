export interface WhereClause {
    [key: string]: unknown;
}

export interface CreateOptions {
    ignoreDuplicates?: boolean;
    beforeInsert?: (data: Record<string, unknown>) => Record<string, unknown>;
}

export interface FindOptions {
    where?: WhereClause;
    limit?: number;
    offset?: number;
    order?: [string, 'ASC' | 'DESC'][];
    beforeUpdate?: (data: Record<string, unknown>) => Record<string, unknown>;
}