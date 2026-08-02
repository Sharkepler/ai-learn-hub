import { getMeta, setMeta } from "./db";
import { uid } from "./util";

export type MediaType = "book" | "movie" | "tv" | "game";
export type MediaStatus = "want" | "doing" | "done";

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  creator?: string; // 作者 / 导演 / 工作室
  status: MediaStatus;
  rating: number; // 0-5，0 表示未评分
  review: string; // 短评（支持 Markdown）
  createdAt: number;
  updatedAt: number;
}

const KEY = "mediaLog";

export async function loadMedia(): Promise<MediaItem[]> {
  const list = (await getMeta<MediaItem[]>(KEY)) || [];
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveMedia(list: MediaItem[]): Promise<void> {
  await setMeta(KEY, list);
}

export function newMedia(partial: Partial<MediaItem> = {}): MediaItem {
  const now = Date.now();
  return {
    id: uid(),
    type: "book",
    title: "",
    creator: "",
    status: "want",
    rating: 0,
    review: "",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
