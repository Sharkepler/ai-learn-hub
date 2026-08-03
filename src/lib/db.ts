import type { Item } from "./types";

const DB_NAME = "ai-learn-hub";
// v2: 确保 meta store 一定存在（v1 的旧库可能缺失 meta，导致 NotFoundError）
const DB_VERSION = 2;
const STORE = "items";
const META = "meta";

let dbp: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1→v2 迁移：确保 items + meta 都存在（防御性创建，不依赖旧版是否正确建了）
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

export async function getDays(): Promise<string[]> {
  const all = await getAllItems();
  return Array.from(new Set(all.map((i) => i.day)))
    .sort()
    .reverse();
}

export async function getMeta<T = any>(key: string): Promise<T | undefined> {
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

// 加密密钥存取（复用主数据库的 meta store，避免独立库 store 缺失）。
// non-extractable CryptoKey 可被 IndexedDB 结构化克隆存储。
export async function getCryptoKey(): Promise<CryptoKey | undefined> {
  return getMeta<CryptoKey>("cryptoKey");
}

export async function setCryptoKey(key: CryptoKey): Promise<void> {
  await setMeta("cryptoKey", key);
}
