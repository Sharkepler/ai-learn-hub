// 设备端 Token 加密（静态加密 at-rest）。
// 思路：用一把 non-extractable 的 AES-GCM 256 密钥（与浏览器源绑定，
// 即使被 dump 也无法读出原始密钥字节）加密 GitHub Token，只把密文存 localStorage。
// 密钥保存在已验证可靠的本地数据库（db.ts 的 meta store），不再单独开库，
// 以避免独立 IndexedDB 库 store 缺失导致的运行时崩溃。
// 说明：这保护的是「静态存储」，不是对抗「能操作本机浏览器环境」的攻击者；
// 若需更强保护，可在此之上叠加用户口令派生密钥（PBKDF2）。

import { getCryptoKey, setCryptoKey } from "./db";

const KEY_ID = "session";

let keyPromise: Promise<CryptoKey> | null = null;

async function getKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    try {
      const existing = await getCryptoKey();
      if (existing) return existing;
      const nk = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false, // non-extractable
        ["encrypt", "decrypt"]
      );
      await setCryptoKey(nk);
      return nk;
    } catch (e) {
      keyPromise = null; // 允许下次重试
      throw e;
    }
  })();
  return keyPromise;
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptJSON(value: unknown): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.stringify({ iv: bufToB64(iv.buffer), ct: bufToB64(ct) });
}

export async function decryptJSON<T = any>(blob: string): Promise<T | null> {
  try {
    const { iv, ct } = JSON.parse(blob);
    if (!iv || !ct) return null;
    const key = await getKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(iv)) },
      key,
      b64ToBuf(ct)
    );
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch {
    return null;
  }
}
