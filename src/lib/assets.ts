// 资产成本计算器数据层。
// 资产（如一双鞋、一台手机）记录购买价与购买日，算出「陪伴天数」与「日均成本」。
// 本地以加密 blob 存于 IndexedDB meta；云端经 sync 层落 data/assets.json（明文 base64，私有仓库）。

import { getMeta, setMeta } from "./db";
import { encryptJSON, decryptJSON } from "./crypto";

export interface Asset {
  id: string;
  name: string;
  price: number; // 元，>= 0
  boughtAt: number; // ms epoch（购买日 0 点）
  note?: string;
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

export async function loadAssets(): Promise<Asset[]> {
  const blob = await getMeta<string>(KEY);
  if (!blob) return [];
  const arr = await decryptJSON<Asset[]>(blob);
  if (!Array.isArray(arr)) return [];
  return arr.sort((a, b) => b.boughtAt - a.boughtAt);
}

export async function saveAssets(list: Asset[]): Promise<void> {
  const blob = await encryptJSON(list);
  await setMeta(KEY, blob);
}
