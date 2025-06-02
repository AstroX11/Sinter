import { Qunatava } from "../index.mjs";
import { createTable } from "../queries/create_table.mjs";
import type { ModelDefinition } from "../types/Model.mjs";

export function defineModel(
	db: Qunatava,
	modelDefinition: Partial<ModelDefinition>
) {
	const normalizedDefinition: ModelDefinition = {
		name: modelDefinition.name,
		tableName:
			modelDefinition.tableName || modelDefinition.pluralizeTablename === true
				? `${modelDefinition.tableName}s`
				: (modelDefinition.tableName ?? modelDefinition.name),
		pluralizeTablename: modelDefinition.pluralizeTablename,
		columns: modelDefinition.columns,
		relationships: modelDefinition.relationships,
		indexes: modelDefinition.indexes,
		constraints: modelDefinition.constraints || [],
		triggers: modelDefinition.triggers,
		views: modelDefinition.views,
		withoutRowid: modelDefinition.withoutRowid ?? false,
		strict: modelDefinition.strict,
		createdAtColumn: modelDefinition.createdAtColumn,
		updatedAtColumn: modelDefinition.updatedAtColumn,
		deletedAtColumn: modelDefinition.deletedAtColumn,
		versionColumn: modelDefinition.versionColumn,
		softDelete: modelDefinition.softDelete ?? false,
		timestamps: modelDefinition.timestamps ?? true,
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
