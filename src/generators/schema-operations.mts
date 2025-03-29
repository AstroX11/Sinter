import type { ModelDefinition } from '../Types.mjs';

export function addTimestamps(def: ModelDefinition): void {
  if (def?.options?.timestamps) {
    def.attributes.createdAt = {
      type: 'DATE',
      allowNull: false,
      defaultValue: Date.now(),
    };
    def.attributes.updatedAt = {
      type: 'DATE',
      allowNull: false,
      defaultValue: Date.now(),
    };
  }
}

export function addParanoidField(def: ModelDefinition): void {
  if (def?.options?.paranoid) {
    def.attributes.deletedAt = {
      type: 'DATE',
      allowNull: true,
    };
  }
}
