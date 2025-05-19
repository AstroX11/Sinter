import { DatabaseSync } from 'node:sqlite';
import { setupTable } from './_model.js';
import {
	DataType,
	type Schema,
	type ModelOptions,
	type CreationAttributes,
	type FindAllOptions,
	type ExtendedWhereOptions,
	type ORMInputValue,
	type FieldDefinition,
	type Association,
	type ModelConstructor,
	type ModelInstance,
} from './types.js';
import {
	parseWhere,
	validateField,
	transformField,
	mapKeys,
	processTimestampsAndParanoid,
	handleSQLFunction,
	processRecordData,
	toSQLInputValue,
	normalizeToOrmInput,
	Op,
	modelRegistry,
	escapeColumnName,
} from './utils.js';

export function model(
	db: DatabaseSync,
	tableName: string,
	schema: Schema,
	options: ModelOptions = {},
) {
	setupTable(db, tableName, schema, options);

	const associations = {
		belongsTo: new Map<string, Association>(),
		hasMany: new Map<string, Association>(),
		hasOne: new Map<string, Association>(),
		belongsToMany: new Map<string, Association>(),
	};

	return class Model implements ModelInstance {
		static name = tableName;
		static schema = schema;

		static async query(query: string): Promise<unknown> {
			return Promise.resolve(db.exec(query));
		}

		static async sync(force: boolean = false) {
			if (force) {
				db.exec(`DROP TABLE IF EXISTS ${tableName}`);
			}
			setupTable(db, tableName, schema, options);
		}

		static belongsTo(
			targetModel: ModelConstructor,
			options: { foreignKey: string; as?: string },
		) {
			const as = options.as || targetModel.name;
			associations.belongsTo.set(as, {
				model: targetModel,
				foreignKey: options.foreignKey,
				as,
			});
			modelRegistry?.set(targetModel.name, targetModel);
		}

		static hasMany(
			targetModel: ModelConstructor,
			options: { foreignKey: string; as?: string },
		) {
			const as = options.as || targetModel.name;
			const registeredModel =
				modelRegistry?.get(targetModel.name) || targetModel;
			if (!registeredModel.schema) {
				throw new Error(`Target model ${targetModel.name} has no schema`);
			}
			associations.hasMany.set(as, {
				model: registeredModel,
				foreignKey: options.foreignKey,
				as,
			});
			modelRegistry?.set(targetModel.name, registeredModel);
		}

		static hasOne(
			targetModel: ModelConstructor,
			options: { foreignKey: string; as?: string },
		) {
			const as = options.as || targetModel.name;
			associations.hasOne.set(as, {
				model: targetModel,
				foreignKey: options.foreignKey,
				as,
			});
			modelRegistry?.set(targetModel.name, targetModel);
		}

		static belongsToMany(
			targetModel: ModelConstructor,
			options: {
				through: string;
				foreignKey: string;
				otherKey: string;
				as?: string;
			},
		) {
			const as = options.as || targetModel.name;
			associations.belongsToMany.set(as, {
				model: targetModel,
				through: options.through,
				foreignKey: options.foreignKey,
				otherKey: options.otherKey,
				as,
			});
			modelRegistry?.set(targetModel.name, targetModel);
		}

		static async update(
			values: Partial<Record<string, ORMInputValue>>,
			opts: { where: ExtendedWhereOptions },
		): Promise<{ changes: number | bigint }> {
			const {
				timestamps = true,
				paranoid = false,
				underscored = false,
			} = options;
			const updates: string[] = [];
			const updateValues: ORMInputValue[] = [];

			for (const [key, value] of Object.entries(values)) {
				const fieldDef = schema[key];
				if (!fieldDef || fieldDef.isVirtual || fieldDef.readOnly) continue;

				if (value === null && fieldDef.allowNull === false) {
					throw new Error(
						`Cannot set ${key} to NULL: field is defined with allowNull: false`,
					);
				}

				const col =
					fieldDef.field ??
					(underscored ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : key);
				const escapedCol = escapeColumnName(col);

				if (fieldDef.type === DataType.JSON) {
					updates.push(`${escapedCol} = ?`);
					updateValues.push(JSON.stringify(value));
					continue;
				}

				const fnResult = handleSQLFunction(value!, key, underscored);

				if (
					typeof fnResult === 'string' &&
					/^\w+\s*\(.*\)$/.test(fnResult.trim())
				) {
					updates.push(`${escapedCol} = ${fnResult}`);
				} else {
					let val: ORMInputValue = value ?? '';
					val = transformField(val, fieldDef, (v: unknown) => {
						val = v as ORMInputValue;
					});
					validateField(val, fieldDef, key);
					updates.push(`${escapedCol} = ?`);
					updateValues.push(val);
				}
			}

			if (timestamps && !('updatedAt' in values)) {
				updates.push(`${escapeColumnName('updatedAt')} = ?`);
				updateValues.push(Date.now());
			}

			if (!updates.length)
				throw new Error('No valid fields provided for update');

			const whereClauseParts: string[] = [];
			const whereValues: ORMInputValue[] = [];

			if (paranoid)
				whereClauseParts.push(
					`${tableName}.${escapeColumnName('deletedAt')} IS NULL`,
				);

			const whereStr = parseWhere(opts.where, whereValues);
			if (whereStr) whereClauseParts.push(whereStr);

			const sql = `UPDATE ${tableName} SET ${updates.join(
				', ',
			)} WHERE ${whereClauseParts.join(' AND ')}`;

			const stmt = db.prepare(sql);
			const result = stmt.run(
				...updateValues.map(toSQLInputValue),
				...whereValues.map(toSQLInputValue),
			);
			return { changes: result.changes };
		}

		static async create(
			data: CreationAttributes<typeof schema, typeof options>,
		): Promise<Record<string, ORMInputValue>> {
			const insertData: Record<string, ORMInputValue> = { ...data };

			processTimestampsAndParanoid(insertData, options);

			for (const [field, definition] of Object.entries(schema)) {
				const def = definition as FieldDefinition;

				if (def.readOnly || def.isVirtual || def.generatedAs) {
					delete insertData[field];
					continue;
				}

				if (insertData[field] === undefined) {
					if (typeof def.defaultFn === 'function') {
						const defaultValue = def.defaultFn();
						insertData[field] = normalizeToOrmInput(defaultValue);
					} else if (def.defaultValue !== undefined) {
						insertData[field] = normalizeToOrmInput(def.defaultValue);
					}
				}

				if (insertData[field] !== undefined) {
					if (typeof def.set === 'function') {
						let finalValue: unknown = insertData[field];
						def.set(finalValue, { value: (v: unknown) => (finalValue = v) });
						insertData[field] = normalizeToOrmInput(finalValue);
					}

					if (typeof def.transform === 'function') {
						insertData[field] = normalizeToOrmInput(
							def.transform(insertData[field]),
						);
					}

					if (def.validate) {
						const validations = Object.entries(def.validate).map(
							async ([validatorName, validator]) => {
								const isValid = await validator(insertData[field]);
								if (!isValid) {
									throw new Error(
										`Validation failed for field "${field}": ${validatorName}`,
									);
								}
							},
						);
						await Promise.all(validations);
					}
				}

				if (
					insertData[field] === undefined &&
					!def.allowNull &&
					!def.autoIncrement
				) {
					throw new Error(
						`Field "${field}" cannot be null and has no default value`,
					);
				}
			}

			processRecordData(schema, insertData, options);

			for (const [field, definition] of Object.entries(schema)) {
				const def = definition as FieldDefinition;
				const operatorKeys = Object.keys(Op);

				if (
					insertData[field] &&
					typeof insertData[field] === 'object' &&
					!Array.isArray(insertData[field])
				) {
					operatorKeys.forEach(op => {
						if (
							insertData[field] &&
							typeof insertData[field] === 'object' &&
							op in insertData[field]
						) {
							const operator = (insertData[field] as Record<string, unknown>)[
								op
							];
							insertData[field] = {
								operator,
								value: operator,
							};
						}
					});
				}

				if (def.hidden && !insertData[field] && !def.allowNull) {
					insertData[field] = data[field];
				}

				if ((def.hidden || def.transient || def.writeOnly) && def.allowNull) {
					delete insertData[field];
				}
			}

			// Check for unique constraints and skip insert entirely if any duplicate exists
			for (const [field, definition] of Object.entries(schema)) {
				const def = definition as FieldDefinition;
				if (def.unique && insertData[field] !== undefined) {
					const column =
						def.field ??
						(options.underscored
							? String(field)
									.replace(/([A-Z])/g, '_$1')
									.toLowerCase()
							: String(field));
					const escaped = escapeColumnName(column);
					const checkSql = `SELECT 1 FROM ${tableName} WHERE ${escaped} = ? LIMIT 1`;
					const checkStmt = db.prepare(checkSql);
					const existing = checkStmt.get(toSQLInputValue(insertData[field]));

					if (existing) {
						return {}; // Abort insert if any unique constraint is violated
					}
				}
			}

			if (Object.keys(insertData).length === 0) {
				return {}; // No fields to insert
			}

			if (options.validate) {
				const modelValidations = Object.entries(options.validate).map(
					async ([validatorName, validator]) => {
						const isValid = await validator(insertData);
						if (!isValid) {
							throw new Error(`Model validation failed: ${validatorName}`);
						}
					},
				);
				await Promise.all(modelValidations);
			}

			if (typeof options.hooks?.beforeCreate === 'function') {
				await options.hooks.beforeCreate(insertData);
			}

			const keys = Object.keys(insertData);
			const escapedKeys = keys.map(key => {
				const fieldDef = schema[key] as FieldDefinition;
				const column =
					fieldDef?.field ??
					(options.underscored
						? String(key)
								.replace(/([A-Z])/g, '_$1')
								.toLowerCase()
						: String(key));
				return escapeColumnName(column);
			});
			const placeholders = keys.map(() => '?').join(', ');
			const values = keys
				.map(key =>
					handleSQLFunction(insertData[key], key, options.underscored ?? false),
				)
				.map(toSQLInputValue);

			const sql = `INSERT INTO ${tableName} (${escapedKeys.join(
				', ',
			)}) VALUES (${placeholders}) RETURNING *`;
			const stmt = db.prepare(sql);
			const result = stmt.get(...values) as Record<string, ORMInputValue>;

			const finalResult: Record<string, ORMInputValue> = { ...result };

			for (const [field, definition] of Object.entries(schema)) {
				const def = definition as FieldDefinition;

				if (typeof def.get === 'function' && finalResult[field] !== undefined) {
					const getterValue = def.get.call(finalResult);
					finalResult[field] = normalizeToOrmInput(getterValue);
				}

				if (def.hidden || def.hiddenFromSelect || def.writeOnly) {
					delete finalResult[field];
				}
			}

			if (typeof options.hooks?.afterCreate === 'function') {
				await options.hooks.afterCreate(finalResult);
			}

			return JSON.parse(JSON.stringify(finalResult));
		}

		static async findAll(
			query: FindAllOptions<typeof schema, typeof options> = {},
		): Promise<Record<string, ORMInputValue>[]> {
			const {
				timestamps = true,
				paranoid = false,
				underscored = false,
			} = options;
			const {
				where,
				include = [],
				attributes,
				limit,
				offset,
				order,
				groupBy,
			} = query;

			const selectFields = (
				attributes ?? Object.keys(schema).filter(k => !schema[k]!.isVirtual)
			).map(k => {
				const fieldDef = schema[k] as FieldDefinition;
				const column =
					fieldDef?.field ??
					(underscored
						? String(k)
								.replace(/([A-Z])/g, '_$1')
								.toLowerCase()
						: String(k));
				return escapeColumnName(column);
			});

			if (timestamps && !attributes)
				selectFields.push(
					escapeColumnName('createdAt'),
					escapeColumnName('updatedAt'),
				);
			if (paranoid && !attributes)
				selectFields.push(escapeColumnName('deletedAt'));

			let sql = `SELECT ${selectFields
				.map(f => `${tableName}.${f}`)
				.join(', ')} FROM ${tableName}`;
			const values: ORMInputValue[] = [];

			const whereClauses: string[] = [];
			if (paranoid)
				whereClauses.push(
					`${tableName}.${escapeColumnName('deletedAt')} IS NULL`,
				);
			if (where) whereClauses.push(parseWhere(where, values));
			if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;
			if (groupBy)
				sql += ` GROUP BY ${
					Array.isArray(groupBy)
						? groupBy.map(escapeColumnName).join(', ')
						: escapeColumnName(groupBy)
				}`;
			if (order)
				sql += ` ORDER BY ${order
					.map(o =>
						Array.isArray(o)
							? `${escapeColumnName(o[0])} ${o[1]}`
							: escapeColumnName(o),
					)
					.join(', ')}`;
			if (limit) sql += ` LIMIT ${limit}`;
			if (offset) sql += ` OFFSET ${offset}`;

			const stmt = db.prepare(sql);
			const results = stmt.all(...values.map(toSQLInputValue)) as Record<
				string,
				ORMInputValue
			>[];

			for (const inc of include) {
				const alias = inc.as || inc.model.name;
				const association =
					associations.belongsTo.get(alias) || associations.hasMany.get(alias);

				let relatedModel: ModelConstructor;
				let foreignKey: string;
				let targetPrimaryKey: string;

				if (!association) {
					const refField = Object.entries(schema).find(
						([_, f]) => f.references?.model === inc.model.name,
					)?.[0];
					if (!refField) {
						throw new Error(`No association or reference found for ${alias}`);
					}
					const modelFromRegistry = modelRegistry?.get(inc.model.name);
					if (!modelFromRegistry) {
						throw new Error(
							`Model ${inc.model.name} not found in modelRegistry`,
						);
					}
					relatedModel = modelFromRegistry;
					foreignKey = refField;
					targetPrimaryKey = schema[refField]?.references?.key || 'id';
				} else {
					relatedModel = association.model;
					foreignKey = association.foreignKey;
					targetPrimaryKey =
						Object.entries(relatedModel.schema).find(
							([_, field]) => field.primaryKey,
						)?.[0] || 'id';
				}

				const primaryKey =
					Object.entries(schema).find(([_, field]) => field.primaryKey)?.[0] ||
					'id';

				if (associations.hasMany.has(alias)) {
					const relatedIds = results
						.map(r => r[primaryKey])
						.filter(id => id !== undefined);
					for (const result of results) {
						result[alias] = [];
					}
					if (relatedIds.length > 0) {
						const relatedRecords = await relatedModel.findAll({
							where: { [foreignKey]: { [Op.in]: relatedIds } },
							...(inc.where || {}),
							attributes: inc.attributes,
							include: inc.include || [],
						});
						for (const result of results) {
							result[alias] = relatedRecords.filter(
								r => r[foreignKey] === result[primaryKey],
							);
						}
					}
				} else {
					const relatedIds = results
						.map(r => r[foreignKey])
						.filter(id => id !== undefined);
					for (const result of results) {
						result[alias] = null;
					}
					if (relatedIds.length > 0) {
						const relatedRecords = await relatedModel.findAll({
							where: { [targetPrimaryKey]: { [Op.in]: relatedIds } },
							...(inc.where || {}),
							attributes: inc.attributes,
							include: inc.include || [],
						});
						for (const result of results) {
							result[alias] =
								relatedRecords.find(
									r => r[targetPrimaryKey] === result[foreignKey],
								) || null;
						}
					}
				}
			}

			return JSON.parse(JSON.stringify(results));
		}

		static async findByPk(
			id: number | string,
		): Promise<Record<string, ORMInputValue> | undefined> {
			const { paranoid = false } = options;
			const primaryKey = Object.entries(schema).find(
				([_, field]) => field.primaryKey,
			);
			if (!primaryKey) throw new Error('No primary key defined in schema.');

			const [pkField, pkDef] = primaryKey;
			const column = pkDef.field ?? pkField;
			const escapedColumn = escapeColumnName(column);
			let sql = `SELECT * FROM ${tableName} WHERE ${escapedColumn} = ?`;
			const values = [id];

			if (paranoid) sql += ` AND ${escapeColumnName('deletedAt')} IS NULL`;

			const stmt = db.prepare(sql);
			return stmt.get(...values.map(toSQLInputValue))
				? JSON.parse(JSON.stringify(stmt.get(...values.map(toSQLInputValue))))
				: (undefined as Record<string, ORMInputValue> | undefined);
		}

		static async findOne(
			opts: FindAllOptions<typeof schema, typeof options> = {},
		): Promise<Record<string, ORMInputValue> | null> {
			const results = await Model.findAll({ ...opts, limit: 1 });
			return results?.[0] ? JSON.parse(JSON.stringify(results[0])) : null;
		}

		static async upsert(
			values: CreationAttributes<typeof schema, typeof options>,
			opts: { where?: ExtendedWhereOptions } = {},
		): Promise<Record<string, ORMInputValue> | null> {
			const processedValues: Record<string, ORMInputValue> = { ...values };
			processTimestampsAndParanoid(processedValues, options);
			processRecordData(schema, processedValues, options);

			let lookupWhere = { ...(opts.where ?? {}) };

			if (Object.keys(lookupWhere).length === 0) {
				const primaryKey = Object.entries(schema).find(
					([_, field]) => field.primaryKey,
				);
				const uniqueKey = Object.entries(schema).find(
					([_, field]) => field.unique,
				);

				if (primaryKey && values[primaryKey[0]] !== undefined) {
					lookupWhere[primaryKey[0]] = values[primaryKey[0]];
				} else if (uniqueKey && values[uniqueKey[0]] !== undefined) {
					lookupWhere[uniqueKey[0]] = values[uniqueKey[0]];
				} else {
					throw new Error(
						'Upsert requires a where clause or a value for primary/unique key',
					);
				}
			}

			const existingRecord = await this.findOne({ where: lookupWhere });

			if (existingRecord) {
				const updateValues = { ...processedValues };

				if (options.timestamps) delete updateValues.createdAt;

				const primaryKey = Object.entries(schema).find(
					([_, field]) => field.primaryKey,
				);
				if (primaryKey) delete updateValues[primaryKey[0]];

				if (Object.keys(updateValues).length > 0) {
					await this.update(updateValues, { where: lookupWhere });
				}

				return this.findOne({ where: lookupWhere });
			} else {
				try {
					return await this.create(
						processedValues as CreationAttributes<
							typeof schema,
							typeof options
						>,
					);
				} catch {
					await this.update(processedValues, { where: lookupWhere });
					return this.findOne({ where: lookupWhere });
				}
			}
		}

		static async bulkCreate(
			records: CreationAttributes<typeof schema, typeof options>[],
			bulkCreateOpts: { ignoreDuplicates?: boolean } = {},
		): Promise<Record<string, ORMInputValue>[]> {
			const {
				timestamps = true,
				paranoid = false,
				underscored = false,
			} = options;
			const { ignoreDuplicates = false } = bulkCreateOpts;

			if (!records.length) return [];

			let dedupedRecords = records;

			if (ignoreDuplicates) {
				const seen = new Set<string>();
				dedupedRecords = records.filter(record => {
					const key = JSON.stringify(record);
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				});
			} else if (Object.entries(schema).some(([_, def]) => def.unique)) {
				const seen = new Set<string>();
				dedupedRecords = records.filter(record => {
					const key = JSON.stringify(
						Object.keys(schema)
							.filter(key => schema[key]?.unique)
							.map(key => record[key])
							.join('|'),
					);
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				});
			}

			if (!dedupedRecords.length) return [];

			const validRecords: typeof dedupedRecords = [];
			for (const record of dedupedRecords) {
				let hasDuplicate = false;
				for (const [field, def] of Object.entries(schema)) {
					if (def.unique && record[field] !== undefined) {
						const column =
							def.field ??
							(underscored
								? String(field)
										.replace(/([A-Z])/g, '_$1')
										.toLowerCase()
								: String(field));
						const escaped = escapeColumnName(column);
						const checkSql = `SELECT 1 FROM ${tableName} WHERE ${escaped} = ? LIMIT 1`;
						const checkStmt = db.prepare(checkSql);
						const exists = checkStmt.get(toSQLInputValue(record[field]));
						if (exists) {
							hasDuplicate = true;
							break;
						}
					}
				}
				if (!hasDuplicate) {
					validRecords.push(record);
				}
			}

			if (!validRecords.length) return [];

			const insertedRecords: Record<string, ORMInputValue>[] = [];
			const firstRecord = validRecords[0];

			const keys = Object.keys(schema).filter(
				key =>
					!schema[key]?.isVirtual &&
					!(schema[key]?.autoIncrement && !firstRecord?.[key]) &&
					!(schema[key]?.generatedAs && !firstRecord?.[key]),
			);

			const mappedKeys = mapKeys(schema, options, keys).map(escapeColumnName);
			if (timestamps)
				mappedKeys.push(
					escapeColumnName('createdAt'),
					escapeColumnName('updatedAt'),
				);
			if (paranoid) mappedKeys.push(escapeColumnName('deletedAt'));

			const placeholders = validRecords
				.map(() => `(${mappedKeys.map(() => '?').join(', ')})`)
				.join(', ');
			const values: ORMInputValue[] = [];

			for (const record of validRecords) {
				const insertData: Record<string, ORMInputValue> = { ...record };
				processTimestampsAndParanoid(insertData, options);
				processRecordData(schema, insertData, options);

				values.push(
					...keys.map(key =>
						handleSQLFunction(insertData[key], key, underscored),
					),
				);

				if (timestamps) {
					const now = Date.now();
					values.push(now, now);
				}

				if (paranoid) {
					values.push(null);
				}
			}

			const sql = `INSERT INTO ${tableName} (${mappedKeys.join(
				', ',
			)}) VALUES ${placeholders} RETURNING *`;

			try {
				const stmt = db.prepare(sql);
				const result = stmt.all(...values.map(toSQLInputValue)) as Record<
					string,
					ORMInputValue
				>[];
				insertedRecords.push(...result);
			} catch (error) {
				throw error;
			}

			return JSON.parse(JSON.stringify(insertedRecords));
		}

		static async findOrCreate(opts: {
			where: ExtendedWhereOptions;
			extras: CreationAttributes<typeof schema, typeof options>;
		}): Promise<[Record<string, ORMInputValue>, boolean]> {
			const existing = await this.findOne({ where: opts.where });
			if (existing) return [existing, false];

			const created = await this.create({ ...opts.extras, ...opts.where });
			return [created, true];
		}

		static async destroy(destroyOptions: {
			where: ExtendedWhereOptions;
			force?: boolean;
		}): Promise<number | unknown> {
			const { paranoid = false } = options;
			const { where, force = false } = destroyOptions;

			if (paranoid && !force)
				return this.update({ deletedAt: Date.now() }, { where });

			const whereClauses: string[] = [];
			const values: ORMInputValue[] = [];

			const whereStr = parseWhere(where, values);
			if (whereStr) whereClauses.push(whereStr);

			if (paranoid)
				whereClauses.push(`${escapeColumnName('deletedAt')} IS NOT NULL`);

			const sql = `DELETE FROM ${tableName} WHERE ${whereClauses.join(
				' AND ',
			)}`;
			const stmt = db.prepare(sql);
			const result = stmt.run(...values.map(toSQLInputValue));
			return result.changes as number;
		}

		static async truncate({
			cascade = false,
		}: { cascade?: boolean } = {}): Promise<void> {
			if (cascade) {
				db.prepare(`DELETE FROM ${tableName}`).run();
				db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(tableName);
			} else {
				db.prepare(`DELETE FROM ${tableName}`).run();
			}
		}

		static async count(
			countOptions: { where?: ExtendedWhereOptions } = {},
		): Promise<number> {
			const { paranoid = false } = options;
			const { where } = countOptions;

			let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
			const whereClauses: string[] = [];
			const values: ORMInputValue[] = [];

			if (paranoid)
				whereClauses.push(`${escapeColumnName('deletedAt')} IS NULL`);
			if (where) whereClauses.push(parseWhere(where, values));

			if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;

			const stmt = db.prepare(sql);
			const result = stmt.get(...values.map(toSQLInputValue)) as {
				count: number;
			};
			return result.count;
		}

		static async sum(
			field: string,
			options: { where?: ExtendedWhereOptions } = {},
		): Promise<number> {
			return this._aggregate('SUM', field, options);
		}

		static async min(
			field: string,
			options: { where?: ExtendedWhereOptions } = {},
		): Promise<number> {
			return this._aggregate('MIN', field, options);
		}

		static async max(
			field: string,
			options: { where?: ExtendedWhereOptions } = {},
		): Promise<number> {
			return this._aggregate('MAX', field, options);
		}

		static async average(
			field: string,
			options: { where?: ExtendedWhereOptions } = {},
		): Promise<number> {
			return this._aggregate('AVG', field, options);
		}

		static async _aggregate(
			fnName: string,
			field: string,
			opts: { where?: ExtendedWhereOptions } = {},
		): Promise<number> {
			const { paranoid = false } = options;
			const { where } = opts;

			const fieldDef = schema[field];
			if (!fieldDef) throw new Error(`Field ${field} not found in schema`);

			const column = fieldDef.field ?? field;
			const escapedColumn = escapeColumnName(column);
			let sql = `SELECT ${fnName}(${escapedColumn}) as value FROM ${tableName}`;
			const whereClauses: string[] = [];
			const values: ORMInputValue[] = [];

			if (paranoid)
				whereClauses.push(`${escapeColumnName('deletedAt')} IS NULL`);
			if (where) whereClauses.push(parseWhere(where, values));

			if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;

			const stmt = db.prepare(sql);
			const result = stmt.get(...values.map(toSQLInputValue)) as {
				value: number | null;
			};
			return result.value ?? 0;
		}

		static async increment(
			fields: Record<string, number>,
			opts: { where: ExtendedWhereOptions; by?: number },
		): Promise<void> {
			const { where, by = 1 } = opts;
			const updates: string[] = [];
			const values: ORMInputValue[] = [];

			for (const [field, amount] of Object.entries(fields)) {
				const fieldDef = schema[field];
				if (!fieldDef) throw new Error(`Field ${field} not found in schema`);
				if (
					!fieldDef.type ||
					![DataType.INTEGER, DataType.BIGINT, DataType.FLOAT].includes(
						fieldDef.type,
					)
				) {
					throw new Error(
						`Field ${field} is not numeric and cannot be incremented`,
					);
				}

				const column = fieldDef.field ?? field;
				const escapedColumn = escapeColumnName(column);
				updates.push(`${escapedColumn} = ${escapedColumn} + ?`);
				values.push(amount * by);
			}

			const whereClauses: string[] = [];
			const whereStr = parseWhere(where, values);
			if (whereStr) whereClauses.push(whereStr);

			if (options.paranoid)
				whereClauses.push(`${escapeColumnName('deletedAt')} IS NULL`);

			const sql = `UPDATE ${tableName} SET ${updates.join(
				', ',
			)} WHERE ${whereClauses.join(' AND ')}`;
			db.prepare(sql).run(...values.map(toSQLInputValue));
		}

		static async decrement(
			fields: Record<string, number>,
			options: { where: ExtendedWhereOptions; by?: number },
		): Promise<void> {
			await this.increment(
				Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, -v])),
				options,
			);
		}

		static async restore(restoreOptions: {
			where: ExtendedWhereOptions;
		}): Promise<number | unknown> {
			if (!options.paranoid)
				throw new Error(
					'Cannot restore records when paranoid mode is disabled',
				);
			return this.update({ deletedAt: null }, { where: restoreOptions.where });
		}

		[key: string]: ORMInputValue;
	} as ModelConstructor;
}
