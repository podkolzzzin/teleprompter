const storage = new Map<string, string>()

function createStorage(): Storage {
  return {
    get length() {
      return storage.size
    },
    clear() {
      storage.clear()
    },
    getItem(key: string) {
      return storage.get(key) ?? null
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null
    },
    removeItem(key: string) {
      storage.delete(key)
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value))
    },
  }
}

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorage(),
    configurable: true,
  })
}
