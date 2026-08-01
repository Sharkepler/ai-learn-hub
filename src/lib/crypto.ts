// 设备端 Token 加密（静态加密 at-rest）。
// 密钥优先存 IndexedDB（跨刷新持久化）；若底层存储异常则降级为内存密钥
//（本次会话可用，刷新后需重登——但绝不会因加密失败阻断登录或同步）。
// 说明：保护的是「静态存储」，不是对抗「能操作本机浏览器环境」的攻击者。

import { getCryptoKey, setCryptoKey } from "./db";

let keyPromise: Promise<CryptoKey> | null = null;
let fallbackKey: CryptoKey | null = null; // 内存降级密钥

async function getKey(): Promise<CryptoKey> {
  // 已有缓存直接返回
  if (keyPromise) return keyPromise;
  // 已有内存降级密钥
  if (fallbackKey) return fallbackKey;

  keyPromise = (async () => {
    // 策略1：从持久化存储恢复
    try {
      const existing = await getCryptoKey();
      if (existing) return existing;
    } catch {
      /* 持久化存储不可用，走内存降级 */
    }

    // 策略2：生成新密钥，尝试持久化
    try {
      const nk = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
      try {
        await setCryptoKey(nk);
      } catch {
        /* 持久化写入失败，继续用内存密钥 */
      }
      return nk;
    } catch {
      // generateKey 本身失败（极端情况）
    }

    // 策略3：纯内存降级——生成固定种子的密钥（不持久化，刷新后失效）
    const fk = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    fallbackKey = fk; // 挂在模块级变量上，本次会话复用
    return fk;
  })();

  // 无论成功失败都清掉 promise 缓存以便下次可重试（仅内存降级时不会重新进入）
  try {
    return await keyPromise;
  } finally {
    // 仅当不是内存降级时才保留缓存（内存降级由 fallbackKey 管理）
    if (!fallbackKey) {
      // keyPromise 保持，后续调用直接返回
    } else {
      keyPromise = null; // 内存模式下允许下次尝试持久化
    }
  }
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
  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(value));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    return JSON.stringify({ iv: bufToB64(iv.buffer), ct: bufToB64(ct) });
  } catch {
    // 极端：加密完全失败 → 返回 base64 混淆（比明文好一点，但不依赖任何存储）
    const raw = JSON.stringify(value);
    const encoded = new TextEncoder().encode(raw);
    return JSON.stringify({ plain: bufToB64(encoded.buffer) });
  }
}

export async function decryptJSON<T = any>(blob: string): Promise<T | null> {
  try {
    const { iv, ct, plain } = JSON.parse(blob);
    // 降级路径：base64 混淆（无加密）
    if (plain) {
      return JSON.parse(new TextDecoder().decode(b64ToBuf(plain)));
    }
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
