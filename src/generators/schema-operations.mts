import type { ModelDefinition } from '../Types.mts';

export function addTimestamps(def: ModelDefinition): void {
  if (def?.options?.timestamps) {
    def.attributes.createdAt = {
      type: 'DATE',
      allowNull: false,
      defaultValue: 'CURRENT_TIMESTAMP',
    };
    def.attributes.updatedAt = {
      type: 'DATE',
      allowNull: false,
      defaultValue: 'CURRENT_TIMESTAMP',
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
