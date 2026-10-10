// A tiny in-memory localStorage so the real persisted store runs under Node.
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
} as Storage;
const tab = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => (tab.has(k) ? tab.get(k)! : null),
  setItem: (k: string, v: string) => void tab.set(k, String(v)),
  removeItem: (k: string) => void tab.delete(k),
  clear: () => tab.clear(),
  key: (i: number) => [...tab.keys()][i] ?? null,
  get length() { return tab.size; },
} as Storage;
export {};
