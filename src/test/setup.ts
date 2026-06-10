// Node 25 defines a non-functional `localStorage` global (it warns about
// --localstorage-file) that shadows jsdom's implementation in vitest.
// Replace it with a working in-memory Storage for tests.
class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
})
