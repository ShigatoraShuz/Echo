export type EntityId = string;

export type Slug = string;

export function isEntityId(value: unknown): value is EntityId {
  return typeof value === "string" && value.length > 0;
}
