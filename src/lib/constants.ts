// 全局共享常量集中管理：存储键、登录白名单、AI 接口、同步默认配置。
// 设计约定：跨模块复用或属「配置」性质的常量放这里；单一模块私有的存储键
// （如 aih_assets / moodLog / monthlyReviews 等）仍留在各自文件，避免无意义搬迁。
import type { SyncConfig } from "./types";

/** localStorage 键：会话、主题、同步配置、最后同步时间。 */
export const SESSION_KEY = "aih_session_v2";
export const LEGACY_SESSION_KEY = "aih_session";
export const THEME_KEY = "aih_theme";
export const SYNC_CFG_KEY = "aih_sync_cfg";
export const LAST_SYNC_KEY = "aih_last_sync";

/** 允许登录的 GitHub 账号白名单；改这里可放开更多账号。 */
export const ALLOWED_LOGINS: string[] = ["Sharkepler"];

/** LongCat AI 接口地址与默认模型（Key 不在此处，走用户加密存储）。 */
export const AI_ENDPOINT = "https://api.longcat.chat/openai/v1/chat/completions";
export const AI_MODEL = "LongCat-2.0";

/** 同步默认配置：云端数据仓位置（owner/name + 分支）。 */
export const DEFAULT_SYNC_CFG: SyncConfig = {
  enabled: true,
  repo: "Sharkepler/ai-learn-hub-data",
  branch: "main",
  auto: true,
};
