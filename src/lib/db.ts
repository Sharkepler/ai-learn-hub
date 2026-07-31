import type { Item } from "./types";
import { ymd } from "./util";

const DB_NAME = "ai-learn-hub";
const DB_VERSION = 1;
const STORE = "items";
const META = "meta";

let dbp: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("kind", "kind", { unique: false });
        s.createIndex("day", "day", { unique: false });
        s.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store);
}

export async function putItem(item: Item): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE, "readwrite").put(item);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function bulkPut(items: Item[]): Promise<void> {
  if (!items.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const store = t.objectStore(STORE);
    items.forEach((it) => store.put(it));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getAllItems(): Promise<Item[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE, "readonly").getAll();
    r.onsuccess = () => resolve((r.result as Item[]) || []);
    r.onerror = () => reject(r.error);
  });
}

export async function getItem(id: string): Promise<Item | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE, "readonly").get(id);
    r.onsuccess = () => resolve(r.result as Item | undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function getDays(): Promise<string[]> {
  const all = await getAllItems();
  return Array.from(new Set(all.map((i) => i.day))).sort().reverse();
}

export async function getMeta(key: string): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, META, "readonly").get(key);
    r.onsuccess = () => resolve(r.result ? (r.result as any).value : undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, META, "readwrite").put({ key, value });
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

// Build an item with consistent day key for per-day cloud files.
export function withDay<T extends { createdAt: number }>(obj: T): T & { day: string } {
  return { ...obj, day: ymd(obj.createdAt) };
}
