import { Qunatava } from "../index.mjs";
import { createTable } from "../queries/create_table.mjs";
import type { ModelDefinition } from "../types/Model.mjs";
import { DataTypes } from "../models/datatypes.mjs";

export function defineModel(
	db: Qunatava,
	modelDefinition: Partial<ModelDefinition>
) {
	const normalizedDefinition: ModelDefinition = {
		name: modelDefinition.name,
		tableName:
			modelDefinition.tableName ||
			(modelDefinition.pluralizeTablename !== false
				? `${modelDefinition.name}s`
				: modelDefinition.name
			).toLowerCase(),
		pluralizeTablename: modelDefinition.pluralizeTablename ?? true,
		columns: modelDefinition.columns || {
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
		},
		relationships: modelDefinition.relationships,
		indexes: modelDefinition.indexes,
		constraints: modelDefinition.constraints,
		triggers: modelDefinition.triggers,
		views: modelDefinition.views,
		withoutRowid: modelDefinition.withoutRowid ?? false,
		strict: modelDefinition.strict ?? true,
		createdAtColumn: modelDefinition.createdAtColumn,
		updatedAtColumn: modelDefinition.updatedAtColumn,
		deletedAtColumn: modelDefinition.deletedAtColumn,
		versionColumn: modelDefinition.versionColumn,
		softDelete: modelDefinition.softDelete ?? false,
		timestamps: modelDefinition.timestamps ?? false,
		underscored: modelDefinition.underscored ?? false,
		displayName: modelDefinition.displayName,
		virtualFields: modelDefinition.virtualFields,
		beforeInsert: modelDefinition.beforeInsert,
		afterInsert: modelDefinition.afterInsert,
		beforeUpdate: modelDefinition.beforeUpdate,
		afterUpdate: modelDefinition.afterUpdate,
		beforeDelete: modelDefinition.beforeDelete,
		afterDelete: modelDefinition.afterDelete,
	};

	createTable(db, normalizedDefinition);

	if (normalizedDefinition.relationships) {
		db.associations(
			normalizedDefinition.name,
			normalizedDefinition.relationships
		);
	}

	return normalizedDefinition;
}
