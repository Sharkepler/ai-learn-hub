import type { GithubUser } from "./types";

// Only this GitHub account may enter. Change here to allow more logins.
const ALLOWED_LOGINS = ["Sharkepler"];

const KEY = "aih_session";

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

export function saveSession(token: string, user: GithubUser, remember = true) {
  cache = { token, user };
  const raw = JSON.stringify(cache);
  try {
    if (remember) localStorage.setItem(KEY, raw);
    else sessionStorage.setItem(KEY, raw);
  } catch {
    /* storage may be unavailable; in-memory cache still works */
  }
}

export function loadSession(): Session | null {
  if (cache) return cache;
  try {
    const raw =
      localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || null;
    if (raw) cache = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return cache;
}

export function getToken(): string | null {
  return loadSession()?.token || null;
}

export function getUser(): GithubUser | null {
  return loadSession()?.user || null;
}

export function logout() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export { ALLOWED_LOGINS };
