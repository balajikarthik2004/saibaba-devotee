import { readLocal, writeLocal } from '../../local'

interface Saved<T> {
  /** Records the user/admin created — stored whole, they have no seeded original. */
  created: T[]
  /** Seeded records that were edited — stored whole so edits survive a reload. */
  overrides: Record<string, T>
  /** Seeded records that were removed. */
  deleted: string[]
}

/**
 * A tiny persisted collection. Seeds are rebuilt on every load (their dates follow the
 * clock), and only what a person changed is mirrored to localStorage under `key`.
 */
export function makeCollection<T extends { id: string }>(key: string, seed: T[]) {
  const seedIds = new Set(seed.map((s) => s.id))
  const saved = readLocal<Saved<T>>(key, { created: [], overrides: {}, deleted: [] })
  const deleted = new Set(saved.deleted ?? [])
  let items: T[] = [
    ...seed.filter((s) => !deleted.has(s.id)).map((s) => saved.overrides?.[s.id] ?? s),
    ...(saved.created ?? []),
  ]
  const overrides: Record<string, T> = { ...(saved.overrides ?? {}) }

  const persist = () =>
    writeLocal(key, {
      created: items.filter((i) => !seedIds.has(i.id)),
      overrides,
      deleted: [...deleted],
    } satisfies Saved<T>)

  return {
    all: (): T[] => items,
    get: (id: string): T | undefined => items.find((i) => i.id === id),
    add(item: T): T {
      items = [...items, item]
      persist()
      return item
    },
    replace(item: T): T {
      items = items.map((i) => (i.id === item.id ? item : i))
      if (seedIds.has(item.id)) overrides[item.id] = item
      persist()
      return item
    },
    remove(id: string) {
      items = items.filter((i) => i.id !== id)
      if (seedIds.has(id)) {
        deleted.add(id)
        delete overrides[id]
      }
      persist()
    },
  }
}

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1679616).toString(36)}`
