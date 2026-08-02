export type ItemKind = "learning" | "inspiration";

export interface BaseItem {
  id: string;
  kind: ItemKind;
  createdAt: number; // ms epoch
  updatedAt: number;
  deleted?: boolean;
  day: string; // YYYY-MM-DD of createdAt (for per-day cloud files)
}

export interface LearningItem extends BaseItem {
  kind: "learning";
  topic: string;
  minutes: number;
  progress: number; // 0-100
  note: string;
}

export interface InspirationItem extends BaseItem {
  kind: "inspiration";
  text: string;
  tags: string[];
  mediaType: "text" | "image";
  media?: string; // data url or remote url
  note: string;
}

export type Item = LearningItem | InspirationItem;

export interface SyncConfig {
  enabled: boolean;
  repo: string; // owner/name
  branch: string;
  auto: boolean;
}

export interface GithubUser {
  login: string;
  name: string;
  avatar: string;
}
