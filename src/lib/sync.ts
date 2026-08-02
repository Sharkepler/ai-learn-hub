import type { Item, SyncConfig } from "./types";
import { getAllItems, bulkPut, getMeta, setMeta } from "./db";
import { getToken } from "./auth";
import { ymd } from "./util";
import { loadAssets, saveAssets, type Asset } from "./assets";

const CFG_KEY = "aih_sync_cfg";
const LAST_KEY = "aih_last_sync";

const DEFAULT_CFG: SyncConfig = {
  enabled: true,
  repo: "Sharkepler/ai-learn-hub-data",
  branch: "main",
  auto: true,
};

// ---------- config ----------
export function getCfg(): SyncConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CFG };
}

export async function saveCfg(patch: Partial<SyncConfig>): Promise<SyncConfig> {
  const next = { ...getCfg(), ...patch };
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// 升级迁移：把上一版「默认关闭同步」导致的旧设备卡在 off 的状态修回开启。
// 仅当配置仍是出厂默认（未自定义仓库）时才自动开启，避免覆盖用户有意的关闭。
export function migrateSyncCfg(): void {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) {
      saveCfg({ enabled: true });
      return;
    }
    const cur = JSON.parse(raw);
    const isFactoryDefaultOff =
      cur &&
      cur.enabled === false &&
      cur.repo === DEFAULT_CFG.repo &&
      cur.branch === DEFAULT_CFG.branch &&
      cur.auto === true;
    if (isFactoryDefaultOff) saveCfg({ enabled: true });
  } catch {
    /* ignore */
  }
}

export function isReady(): boolean {
  const c = getCfg();
  return c.enabled && !!getToken();
}

export async function getLastSync(): Promise<number | null> {
  return (await getMeta(LAST_KEY)) || null;
}

// ---------- helpers ----------
function toB64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

// atob 的逆操作：base64 → Uint8Array → TextDecoder 正确还原 UTF-8 多字节字符。
// 不用这个的话，中文等非 ASCII 字符在 atob→JSON.parse 链路中会变成乱码。
function fromB64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function gh(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  if (!res.ok && res.status !== 404) {
    const err = new Error(`GitHub ${res.status}`) as any;
    err.status = res.status;
    throw err;
  }
  return res;
}

// Last-write-wins by updatedAt; soft-deleted items propagate too.
function mergeItems(local: Item[], remote: Item[]): Item[] {
  const map = new Map<string, Item>();
  const all = [...remote, ...local]; // local wins ties (later in array)
  for (const it of all) {
    const prev = map.get(it.id);
    if (!prev || it.updatedAt >= prev.updatedAt) map.set(it.id, it);
  }
  return Array.from(map.values());
}

// ---------- day file ops ----------
async function getDayFile(
  day: string,
  token: string,
  cfg: SyncConfig
): Promise<{ items: Item[]; sha: string | null }> {
  const path = `/repos/${cfg.repo}/contents/data/${day}.json?ref=${cfg.branch}`;
  const res = await gh(path, token);
  if (res.status === 404) return { items: [], sha: null };
  const data = await res.json();
  try {
    const items = JSON.parse(fromB64(data.content))?.items || [];
    return { items, sha: data.sha };
  } catch {
    return { items: [], sha: data.sha || null };
  }
}

async function putDayFile(
  day: string,
  items: Item[],
  token: string,
  cfg: SyncConfig,
  sha: string | null
): Promise<string> {
  const content = toB64(JSON.stringify({ day, items }, null, 0));
  const path = `/repos/${cfg.repo}/contents/data/${day}.json`;
  const body: any = {
    message: `sync ${day}`,
    content,
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const res = await gh(path, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.content?.sha || sha || "";
}

// Push one day's file with optimistic-lock conflict retry (up to 5).
export async function pushDay(day: string, token?: string): Promise<boolean> {
  const tk = token || getToken();
  const cfg = getCfg();
  if (!tk || !cfg.enabled) return false;
  const all = await getAllItems();
  const local = all.filter((i) => i.day === day);
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const { items: remote, sha } = await getDayFile(day, tk, cfg);
    const merged = mergeItems(local, remote);
    try {
      await putDayFile(day, merged, tk, cfg, sha);
      return true;
    } catch (e: any) {
      if (e?.status === 409) continue; // conflict: re-pull + retry
      throw e;
    }
  }
  throw new Error("同步冲突重试次数过多");
}

// List all day-files in the remote data/ directory.
async function listDataDays(token: string, cfg: SyncConfig): Promise<string[]> {
  const path = `/repos/${cfg.repo}/contents/data?ref=${cfg.branch}`;
  try {
    const res = await gh(path, token);
    if (res.status === 404) return [];
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((f: any) => typeof f.name === "string" && f.name.endsWith(".json"))
      .map((f: any) => f.name.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

// Pull every remote day into the local DB (first load / new device).
export async function pullAll(token?: string): Promise<number> {
  const tk = token || getToken();
  const cfg = getCfg();
  if (!tk || !cfg.enabled) return 0;
  const days = await listDataDays(tk, cfg);
  let n = 0;
  for (const d of days) {
    const { items } = await getDayFile(d, tk, cfg);
    if (items.length) {
      await bulkPut(items);
      n += items.length;
    }
  }
  // 拉取资产成本计算器的数据
  try {
    const pulled = await pullAssets(tk);
    if (pulled) n += pulled;
  } catch {
    /* 资产文件可能尚不存在，忽略 */
  }
  await setMeta(LAST_KEY, Date.now());
  return n;
}

// Pull a day's remote items into local DB (for day-filter search).
export async function pullDayInto(day: string, token?: string): Promise<number> {
  const tk = token || getToken();
  const cfg = getCfg();
  if (!tk || !cfg.enabled) return 0;
  const { items } = await getDayFile(day, tk, cfg);
  if (!items.length) return 0;
  await bulkPut(items);
  return items.length;
}

// Two-way sync: pull remote first, then push local.
export async function syncNow(opts: { refresh?: boolean } = {}): Promise<{
  ok: boolean;
  pulled: number;
  pushed: number;
  error?: string;
}> {
  const tk = getToken();
  const cfg = getCfg();
  if (!tk || !cfg.enabled)
    return { ok: false, pulled: 0, pushed: 0, error: "未启用或未登录" };
  try {
    const pulled = await pullAll(tk);
    const all = await getAllItems();
    const days = Array.from(new Set(all.map((i) => i.day))).sort().reverse();
    let pushed = 0;
    for (const d of days) {
      if (await pushDay(d, tk)) pushed++;
    }
    // 同步资产成本计算器数据
    try {
      await pushAssets(tk);
    } catch {
      /* best-effort */
    }
    await setMeta(LAST_KEY, Date.now());
    return { ok: true, pulled, pushed };
  } catch (e: any) {
    return { ok: false, pulled: 0, pushed: 0, error: e?.message || "同步失败" };
  }
}

// ---------- assets.json (资产成本计算器) ----------
async function getAssetsFile(
  token: string,
  cfg: SyncConfig
): Promise<{ assets: Asset[]; sha: string | null }> {
  const path = `/repos/${cfg.repo}/contents/data/assets.json?ref=${cfg.branch}`;
  const res = await gh(path, token);
  if (res.status === 404) return { assets: [], sha: null };
  const data = await res.json();
  try {
    const assets = JSON.parse(fromB64(data.content))?.assets || [];
    return { assets, sha: data.sha };
  } catch {
    return { assets: [], sha: data.sha || null };
  }
}

async function putAssetsFile(
  assets: Asset[],
  token: string,
  cfg: SyncConfig,
  sha: string | null
): Promise<string> {
  const content = toB64(JSON.stringify({ assets }, null, 0));
  const path = `/repos/${cfg.repo}/contents/data/assets.json`;
  const body: any = {
    message: "sync assets",
    content,
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const res = await gh(path, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.content?.sha || sha || "";
}

// 同 id 以本地为准（last-write-wins 的简化：本地覆盖远程）
function mergeAssets(local: Asset[], remote: Asset[]): Asset[] {
  const map = new Map<string, Asset>();
  remote.forEach((a) => map.set(a.id, a));
  local.forEach((a) => map.set(a.id, a));
  return Array.from(map.values());
}

export async function pushAssets(token?: string): Promise<boolean> {
  const tk = token || getToken();
  const cfg = getCfg();
  if (!tk || !cfg.enabled) return false;
  const local = await loadAssets();
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const { assets: remote, sha } = await getAssetsFile(tk, cfg);
    const merged = mergeAssets(local, remote);
    try {
      await putAssetsFile(merged, tk, cfg, sha);
      return true;
    } catch (e: any) {
      if (e?.status === 409) continue; // conflict: re-pull + retry
      throw e;
    }
  }
  throw new Error("资产同步冲突重试次数过多");
}

export async function pullAssets(token?: string): Promise<number> {
  const tk = token || getToken();
  const cfg = getCfg();
  if (!tk || !cfg.enabled) return 0;
  const { assets } = await getAssetsFile(tk, cfg);
  if (!assets.length) return 0;
  await saveAssets(assets); // 写回本地（加密）
  return assets.length;
}

export { ymd };
