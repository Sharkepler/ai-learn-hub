import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Item } from "../lib/types";
import { getAllItems, putItem, getMeta, setMeta } from "../lib/db";
import { schedulePush, syncNow } from "../lib/sync";

interface StoreCtx {
  items: Item[];
  loading: boolean;
  reload: () => Promise<void>;
  addItem: (item: Item) => Promise<void>;
  updateItem: (item: Item) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  lastSync: number | null;
}

const Ctx = createContext<StoreCtx | null>(null);

const LAST_KEY = "aih_last_sync";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const inFlight = useRef(false);

  const reload = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const all = await getAllItems();
    all.sort((a, b) => b.createdAt - a.createdAt);
    setItems(all);
    setLastSync((await getMeta(LAST_KEY)) || null);
    setLoading(false);
    inFlight.current = false;
  }, []);

  const addItem = useCallback(
    async (item: Item) => {
      await putItem(item);
      schedulePush(item.day);
      setItems((prev) => [item, ...prev]);
    },
    []
  );

  const updateItem = useCallback(async (item: Item) => {
    await putItem(item);
    schedulePush(item.day);
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }, []);

  const removeItem = useCallback(async (id: string) => {
    const cur = items.find((i) => i.id === id);
    if (!cur) return;
    const soft: Item = { ...cur, deleted: true, updatedAt: Date.now() };
    await putItem(soft);
    schedulePush(soft.day);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [items]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <Ctx.Provider
      value={{ items, loading, reload, addItem, updateItem, removeItem, lastSync }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): StoreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

export { syncNow };
