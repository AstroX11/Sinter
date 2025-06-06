import type { RelationshipDefinition } from "../types/Model.mjs";

export class ModelRelationshipManager {
	private relationships: Map<string, RelationshipDefinition[]>;

	constructor() {
		this.relationships = new Map();
	}

	defineRelationships(
		modelName: string,
		relationships: RelationshipDefinition[]
	): void {
		const existing = this.relationships.get(modelName) ?? [];
		this.relationships.set(modelName, [...existing, ...relationships]);
	}

	getRelationships(modelName: string): RelationshipDefinition[] {
		return this.relationships.get(modelName) ?? [];
	}
}
