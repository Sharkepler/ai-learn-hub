import { getMeta, setMeta } from "./db";
import { uid, ymd } from "./util";

export interface MoodItem {
  id: string;
  mood: string; // MOODS 中的 key
  emoji: string; // 实际 emoji，冗余存储便于展示
  energy: number; // 精力值 1-5
  note: string; // 短记（支持 Markdown）
  day: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

export const MOODS = [
  { key: "happy", emoji: "😄", label: "开心" },
  { key: "excited", emoji: "🤩", label: "兴奋" },
  { key: "calm", emoji: "😌", label: "平静" },
  { key: "neutral", emoji: "😐", label: "平淡" },
  { key: "tired", emoji: "😴", label: "疲惫" },
  { key: "anxious", emoji: "😟", label: "焦虑" },
  { key: "sad", emoji: "😢", label: "低落" },
  { key: "angry", emoji: "😡", label: "烦躁" },
];

export function moodOf(key: string) {
  return MOODS.find((m) => m.key === key) || MOODS[3];
}

const KEY = "moodLog";

export async function loadMoods(): Promise<MoodItem[]> {
  const list = (await getMeta<MoodItem[]>(KEY)) || [];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveMoods(list: MoodItem[]): Promise<void> {
  await setMeta(KEY, list);
}

export function newMood(partial: Partial<MoodItem> = {}): MoodItem {
  const now = Date.now();
  const init = moodOf(partial.mood || "neutral");
  return {
    id: uid(),
    mood: init.key,
    emoji: init.emoji,
    energy: 3,
    note: "",
    day: ymd(),
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
