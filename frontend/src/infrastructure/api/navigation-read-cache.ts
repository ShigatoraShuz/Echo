// Short-lived view data only. Never persist private responses or cache access gates.
const entries = new Map<string, { promise: Promise<unknown>; expires: number }>();
let listening = false;
let generation = 0;
export function invalidateNavigationReads() {
  generation++;
  entries.clear();
}
export function navigationReadGeneration() {
  listen();
  return generation;
}
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  for (const event of [
    "echo:sensitive-state-cleared",
    "echo:professional-access-lost",
    "echo:privacy-changed",
    "echo:journal-changed",
    "echo:analysis-completed",
    "echo:profile-changed",
    "echo:appointments-changed",
    "focus",
  ])
    window.addEventListener(event, invalidateNavigationReads);
  document.addEventListener("visibilitychange", invalidateNavigationReads);
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === "echo:privacy-updated") invalidateNavigationReads();
  });
}
export function readNavigationData<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") return load();
  listen();
  const now = Date.now();
  for (const [id, entry] of entries) if (entry.expires <= now) entries.delete(id);
  const existing = entries.get(key);
  if (existing) return existing.promise.then((value) => structuredClone(value) as T);
  const entry = { promise: Promise.resolve() as Promise<unknown>, expires: Infinity };
  entry.promise = load()
    .then((value) => {
      entry.expires = Date.now() + 60_000;
      return value;
    })
    .catch((error: unknown) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
  while (entries.size >= 24) entries.delete(entries.keys().next().value!);
  entries.set(key, entry);
  return entry.promise.then((value) => structuredClone(value) as T);
}
