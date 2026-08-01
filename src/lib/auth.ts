import type { GithubUser } from "./types";
import { encryptJSON, decryptJSON } from "./crypto";

// Only this GitHub account may enter. Change here to allow more logins.
const ALLOWED_LOGINS = ["Sharkepler"];

// 旧版明文 Token 的 key（升级时清理，避免明文残留）
const LEGACY_KEY = "aih_session";
// 新版：仅存 AES-GCM 密文
const SESSION_KEY = "aih_session_v2";

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
  remember = true
): Promise<void> {
  cache = { token, user };
  const blob = await encryptJSON(cache); // 加密后再落盘
  try {
    if (remember) localStorage.setItem(SESSION_KEY, blob);
    else sessionStorage.setItem(SESSION_KEY, blob);
  } catch {
    /* storage may be unavailable; in-memory cache still works */
  }
}

// 启动时异步解密恢复会话（Token 已加密，需 await）。
export async function initSession(): Promise<Session | null> {
  if (cache) return cache;
  // 清理旧版明文 Token，避免明文残留
  try {
    localStorage.removeItem(LEGACY_KEY);
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
    /* ignore */
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
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export { ALLOWED_LOGINS };
