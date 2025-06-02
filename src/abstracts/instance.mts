import type { Qunatava } from "../index.mjs";
import type {
	ModelDefinition,
	WhereClause,
	CreateOptions,
	FindOptions,
	QueryResult,
} from "../types/index.mjs";
import { parseWhere } from "../utils/whereParser.js";

export class ModelInstance {
	private db: Qunatava;
	private model: ModelDefinition;

	constructor(db: Qunatava, model: ModelDefinition) {
		this.db = db;
		this.model = model;
	}

	private buildWhereClause(where: WhereClause): {
		sql: string;
		params: unknown[];
	} {
		if (!where || Object.keys(where).length === 0) {
			return { sql: "", params: [] };
		}
		const params: unknown[] = [];
		const sql = parseWhere(where, params);
		return { sql: sql ? `WHERE ${sql}` : "", params };
	}

	async findOne<T = Record<string, unknown>>(
		options: FindOptions = {}
	): Promise<T | null> {
		const { where = {}, limit = 1 } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `SELECT * FROM ${this.model.tableName} ${whereSql} LIMIT ${limit}`;
		const result: QueryResult<T> = this.db.query<T>(query, params);
		return result.rows[0] || null;
	}

	async findAll<T = Record<string, unknown>>(
		options: FindOptions = {}
	): Promise<T[]> {
		const { where = {}, limit, offset, order } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		let query = `SELECT * FROM ${this.model.tableName} ${whereSql}`;
		if (order) {
			const orderClauses = order.map(
				([field, direction]) => `${field} ${direction}`
			);
			query += ` ORDER BY ${orderClauses.join(", ")}`;
		}
		if (limit) query += ` LIMIT ${limit}`;
		if (offset) query += ` OFFSET ${offset}`;
		const result: QueryResult<T> = this.db.query<T>(query, params);
		return result.rows;
	}

	async findByPk<T = Record<string, unknown>>(
		pk: number | string
	): Promise<T | null> {
		return this.findOne<T>({ where: { id: pk } });
	}

	async create<T extends Record<string, unknown>>(
		data: T,
		options: CreateOptions = {}
	): Promise<T> {
		const { beforeInsert } = this.model;
		const processedData = beforeInsert ? beforeInsert(data) : data;
		const keys = Object.keys(processedData);
		const values = Object.values(processedData);
		const placeholders = keys.map(() => "?").join(", ");
		const query = `INSERT ${options.ignoreDuplicates ? "OR IGNORE" : ""} INTO ${
			this.model.tableName
		} (${keys.join(", ")}) VALUES (${placeholders})`;
		const result = this.db.query(query, values);
		if (result.lastInsertRowid) {
			return this.findByPk<T>(result.lastInsertRowid as number).then(row => row!);
		}
		return processedData as T;
	}

	async findOrCreate<T extends Record<string, unknown>>(
		options: FindOptions & { defaults: T }
	): Promise<T> {
		const { where = {}, defaults } = options;
		const record = await this.findOne<T>({ where });
		if (record) return record;
		return this.create<T>(defaults);
	}

	async destroy(options: FindOptions = {}): Promise<number> {
		const { where = {} } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `DELETE FROM ${this.model.tableName} ${whereSql}`;
		const result = this.db.query(query, params);
		return result.changes;
	}

	async truncate(): Promise<void> {
		this.db.query(`DELETE FROM ${this.model.tableName}`);
	}

	async sum(field: string, options: FindOptions = {}): Promise<number> {
		const { where = {} } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `SELECT SUM(${field}) as total FROM ${this.model.tableName} ${whereSql}`;
		const result = this.db.query<{ total: number }>(query, params);
		return result.rows[0]?.total || 0;
	}

	async min(field: string, options: FindOptions = {}): Promise<number> {
		const { where = {} } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `SELECT MIN(${field}) as minimum FROM ${this.model.tableName} ${whereSql}`;
		const result = this.db.query<{ minimum: number }>(query, params);
		return result.rows[0]?.minimum || 0;
	}

	async increment(
		field: string,
		options: FindOptions & { by: number } = { by: 1 }
	): Promise<number> {
		const { where = {}, by = 1 } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `UPDATE ${this.model.tableName} SET ${field} = ${field} + ? ${whereSql}`;
		const result = this.db.query(query, [by, ...params]);
		return result.changes;
	}

	async count(options: FindOptions = {}): Promise<number> {
		const { where = {} } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `SELECT COUNT(*) as count FROM ${this.model.tableName} ${whereSql}`;
		const result = this.db.query<{ count: number }>(query, params);
		return result.rows[0]?.count || 0;
	}

	async max(field: string, options: FindOptions = {}): Promise<number> {
		const { where = {} } = options;
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `SELECT MAX(${field}) as maximum FROM ${this.model.tableName} ${whereSql}`;
		const result = this.db.query<{ maximum: number }>(query, params);
		return result.rows[0]?.maximum || 0;
	}

	async update<T extends Record<string, unknown>>(
		data: Partial<T>,
		options: FindOptions = {}
	): Promise<number> {
		const { where = {}, beforeUpdate } = options;
		const processedData = beforeUpdate ? beforeUpdate(data) : data;
		const keys = Object.keys(processedData);
		const values = Object.values(processedData);
		const setClause = keys.map(key => `${key} = ?`).join(", ");
		const { sql: whereSql, params } = this.buildWhereClause(where);
		const query = `UPDATE ${this.model.tableName} SET ${setClause} ${whereSql}`;
		const result = this.db.query(query, [...values, ...params]);
		return result.changes;
	}

	async bulkCreate<T extends Record<string, unknown>>(
		records: T[],
		options: CreateOptions = {}
	): Promise<T[]> {
		const results: T[] = [];
		for (const record of records) {
			const created = await this.create<T>(record, options);
			results.push(created);
		}
		return results;
	}
}
