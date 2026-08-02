import { getMeta, setMeta } from "./db";
import { uid } from "./util";

export interface ReviewItem {
  id: string;
  month: string; // YYYY-MM
  highlights: string; // 本月高光 / 成就（Markdown）
  lows: string; // 本月不足 / 待改进
  next: string; // 下月计划 / 目标（Markdown）
  rating: number; // 自评 0-5，0 表示未评
  createdAt: number;
  updatedAt: number;
}

const KEY = "monthlyReviews";

export async function loadReviews(): Promise<ReviewItem[]> {
  const list = (await getMeta<ReviewItem[]>(KEY)) || [];
  return list.sort((a, b) => b.month.localeCompare(a.month));
}

export async function saveReviews(list: ReviewItem[]): Promise<void> {
  await setMeta(KEY, list);
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function newReview(partial: Partial<ReviewItem> = {}): ReviewItem {
  const now = Date.now();
  return {
    id: uid(),
    month: thisMonth(),
    highlights: "",
    lows: "",
    next: "",
    rating: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
