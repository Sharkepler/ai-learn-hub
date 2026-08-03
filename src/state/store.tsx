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
import { getAllItems, putItem, getMeta } from "../lib/db";
import { pushDay, syncNow } from "../lib/sync";
import { LAST_SYNC_KEY } from "../lib/constants";

// 保存/删除时真正推送到云端再返回是否成功；超时（默认 10s）视为未同步，避免离线时卡住 UI。
async function pushWithTimeout(day: string, ms = 10000): Promise<boolean> {
  try {
    const p = pushDay(day);
    const t = new Promise<boolean>((_, rej) =>
      setTimeout(() => rej(new Error("sync-timeout")), ms),
    );
    return await Promise.race([p, t]);
  } catch {
    return false;
  }
}

interface StoreCtx {
  items: Item[];
  loading: boolean;
  reload: () => Promise<void>;
  addItem: (item: Item) => Promise<boolean>;
  updateItem: (item: Item) => Promise<boolean>;
  removeItem: (id: string) => Promise<boolean>;
  lastSync: number | null;
}

const Ctx = createContext<StoreCtx | null>(null);

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
    setLastSync((await getMeta(LAST_SYNC_KEY)) || null);
    setLoading(false);
    inFlight.current = false;
  }, []);

  const addItem = useCallback(async (item: Item): Promise<boolean> => {
    await putItem(item);
    const synced = await pushWithTimeout(item.day);
    setItems((prev) => [item, ...prev]);
    return synced;
  }, []);

  const updateItem = useCallback(async (item: Item): Promise<boolean> => {
    await putItem(item);
    const synced = await pushWithTimeout(item.day);
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    return synced;
  }, []);

  const removeItem = useCallback(
    async (id: string): Promise<boolean> => {
      const cur = items.find((i) => i.id === id);
      if (!cur) return false;
      const soft: Item = { ...cur, deleted: true, updatedAt: Date.now() };
      await putItem(soft);
      const synced = await pushWithTimeout(soft.day);
      setItems((prev) => prev.filter((i) => i.id !== id));
      return synced;
    },
    [items],
  );

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
