import type {
	ModelDefinition,
	RelationshipDefinition,
} from "../types/Model.mjs";

export class ModelRelationshipManager {
	private models: Map<string, ModelDefinition>;
	private relationships: Map<string, RelationshipDefinition[]>;

	constructor() {
		this.models = new Map();
		this.relationships = new Map();
	}

	registerModel(model: ModelDefinition): void {
		this.models.set(model.name, model);
		this.relationships.set(model.name, []);
	}

	defineRelationships(
		modelName: string,
		relationships: RelationshipDefinition[]
	): void {
		if (!this.models.has(modelName)) {
			throw new Error(`Model ${modelName} not registered`);
		}
		this.relationships.set(modelName, relationships);
	}

	getModel(modelName: string): ModelDefinition | undefined {
		return this.models.get(modelName);
	}

	getRelationships(modelName: string): RelationshipDefinition[] {
		return this.relationships.get(modelName) ?? [];
	}
}
