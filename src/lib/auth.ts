import type { GithubUser } from "./types";
import { encryptJSON, decryptJSON } from "./crypto";
import { ALLOWED_LOGINS, LEGACY_SESSION_KEY, SESSION_KEY } from "./constants";

// 登录白名单 / 会话密钥已集中到 ./constants：
// - ALLOWED_LOGINS：仅这些 GitHub 账号可登录
// - SESSION_KEY：仅存 AES-GCM 密文（新版）
// - LEGACY_SESSION_KEY：旧版明文 Token 的 key，升级时清理避免明文残留

interface Session {
  token: string;
  user: GithubUser;
}

let cache: Session | null = null;

async function ghFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}`) as any;
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function verifyToken(token: string): Promise<GithubUser> {
  const res = await ghFetch("/user", token);
  const u = await res.json();
  const login: string = u.login;
  if (!ALLOWED_LOGINS.includes(login)) {
    const err = new Error("账号无权限") as any;
    err.forbidden = true;
    throw err;
  }
  return {
    login,
    name: u.name || u.login,
    avatar: u.avatar_url || "",
  };
}

export async function saveSession(
  token: string,
  user: GithubUser,
  remember = true,
): Promise<void> {
  cache = { token, user };
  // 加密落盘；若加密失败（如底层存储异常）也不阻断登录，
  // 内存中已有 token 缓存，应用可正常使用，仅刷新后需重新登录。
  try {
    const blob = await encryptJSON(cache);
    if (remember) localStorage.setItem(SESSION_KEY, blob);
    else sessionStorage.setItem(SESSION_KEY, blob);
  } catch {
    /* encryption failed; rely on in-memory cache */
  }
}

// 启动时异步解密恢复会话（Token 已加密，需 await）。
// 任何异常都不抛出（包括底层 IndexedDB 崩溃），返回 null 让用户重新登录。
export async function initSession(): Promise<Session | null> {
  if (cache) return cache;
  // 清理旧版明文 Token，避免明文残留
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    const blob =
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || null;
    if (!blob) return null;
    const s = await decryptJSON<Session>(blob);
    if (s && s.token && s.user) {
      cache = s;
      return cache;
    }
  } catch {
    /* 解密失败（可能是旧密钥/存储损坏），静默降级到需重新登录 */
  }
  return null;
}

// 同步访问：仅在 initSession 完成后才可靠（缓存已解密）。
export function getToken(): string | null {
  return cache?.token || null;
}

export function getUser(): GithubUser | null {
  return cache?.user || null;
}

export function logout() {
  cache = null;
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export { ALLOWED_LOGINS };
