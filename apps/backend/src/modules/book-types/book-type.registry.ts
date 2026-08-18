import { BOOK_TYPE_CATALOG, type BookTypeDefinition, type BookTypeId } from '@kdp/shared';

/**
 * Runtime plugin registry (§6): initialized from the static shared catalog,
 * but exposes `register()` so new book types can be added at runtime by a
 * future module without touching this file or any caller — the mechanism
 * the brief calls a "BookType plugin architecture." All current types are
 * registered from `@kdp/shared` at import time below.
 */
const registry = new Map<string, BookTypeDefinition>(Object.entries(BOOK_TYPE_CATALOG));

export function registerBookType(definition: BookTypeDefinition): void {
  registry.set(definition.id, definition);
}

export function getBookType(id: string): BookTypeDefinition | undefined {
  return registry.get(id);
}

export function requireBookType(id: BookTypeId): BookTypeDefinition {
  const definition = registry.get(id);
  if (!definition) {
    throw new Error(`Unknown book type: ${id}`);
  }
  return definition;
}

export function listBookTypes(): BookTypeDefinition[] {
  return Array.from(registry.values());
}
