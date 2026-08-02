// 资产成本计算器数据层。
// 资产（如一双鞋、一台手机）记录购买价与购买日，算出「陪伴天数」与「日均成本」。
// 本地以加密 blob 存于 IndexedDB meta；云端经 sync 层落 data/assets.json（明文 base64，私有仓库）。
//
// 同步模型（与全局 Item 一致）：
//  - 每条资产带 updatedAt，跨设备合并采用「按 id 的 Last-Write-Wins」。
//  - 删除用软删除（deleted:true）随合并传播，避免 A 删了 B 又复活。

import { getMeta, setMeta } from "./db";
import { encryptJSON, decryptJSON } from "./crypto";

export interface Asset {
  id: string;
  categoryId?: string; // 目录分类 id（自定义物品无）
  itemId?: string; // 目录具体物品 id（自定义物品无）
  name: string; // 展示名（选目录物品时自动填充，可手动覆盖）
  price: number; // 元，>= 0
  boughtAt: number; // ms epoch（购买日 0 点）
  note?: string;
  photo?: string; // 用户上传的实物照片（已压缩 base64），优先于目录图标
  updatedAt: number; // 冲突解决时间戳（LWW）
  deleted?: boolean; // 软删除，跨设备传播
}

const KEY = "aih_assets";
const DAY = 86400000;

// 陪伴天数：从购买日到今天（不足 1 天按 0 天，但日均成本按「当天即 1 天」友好处理）
export function daysTogether(boughtAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - boughtAt) / DAY));
}

// 日均成本：总价 / 陪伴天数（当天购买按 1 天计，避免除零得到无穷大）
export function dailyCost(price: number, days: number): number {
  return days <= 0 ? price : price / days;
}

export function fmtMoney(n: number): string {
  if (!isFinite(n)) return "—";
  return "¥" + n.toFixed(2);
}

// 归一化：补齐 updatedAt，确保 LWW 可比较（兼容旧数据无该字段）
export function normalizeAsset(a: Asset): Asset {
  return { ...a, updatedAt: a.updatedAt || a.boughtAt || Date.now() };
}

// 原始列表（含软删除）——用于合并与同步
export async function loadAssetsRaw(): Promise<Asset[]> {
  const blob = await getMeta<string>(KEY);
  if (!blob) return [];
  const arr = await decryptJSON<Asset[]>(blob);
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeAsset).sort((a, b) => b.boughtAt - a.boughtAt);
}

// 对外可见列表（排除软删除）
export async function loadAssets(): Promise<Asset[]> {
  const all = await loadAssetsRaw();
  return all.filter((a) => !a.deleted);
}

export async function saveAssetsRaw(list: Asset[]): Promise<void> {
  const blob = await encryptJSON(list.map(normalizeAsset));
  await setMeta(KEY, blob);
}

// 跨设备合并：按 id 的 Last-Write-Wins。
// 远程先入、本地后入：同 updatedAt 时本地胜，避免「刚在本地改完又被云端旧值覆盖」。
export function mergeAssetsLWW(local: Asset[], remote: Asset[]): Asset[] {
  const map = new Map<string, Asset>();
  const all = [...remote.map(normalizeAsset), ...local.map(normalizeAsset)];
  for (const a of all) {
    const prev = map.get(a.id);
    if (!prev || a.updatedAt >= prev.updatedAt) map.set(a.id, a);
  }
  return Array.from(map.values());
}

// ---- 订阅：同步完成后通知 UI 刷新（实现跨设备「准实时」更新）----
const subs = new Set<() => void>();
export function subscribeAssets(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
export function notifyAssetsChanged() {
  subs.forEach((cb) => {
    try {
      cb();
    } catch {
      /* 忽略单个订阅者异常 */
    }
  });
}
