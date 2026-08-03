// Date / formatting helpers. Consistent day key = local YYYY-MM-DD.

export const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(d: Date | number = new Date()): string {
  const dt = typeof d === "number" ? new Date(d) : d;
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function today(): string {
  return ymd(new Date());
}

export function addDays(n: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return d;
}

export function dayList(count: number, end: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(ymd(addDays(-i, end)));
  return out;
}

export function fmtDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][dt.getDay()];
  return `${m}月${d}日 ${wk}`;
}

export function fmtDateTime(ts: number): string {
  const dt = new Date(ts);
  return `${ymd(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function fmtDur(min: number): string {
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

export function uid(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

export function extractTags(text: string): string[] {
  const set = new Set<string>();
  (text || "").replace(/#([^\s#]+)/g, (_, t: string) => {
    set.add(t);
    return "";
  });
  return Array.from(set);
}

export function escapeHtml(s: string): string {
  return (s || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// 客户端压缩图片：缩放到 maxDim 以内并以 JPEG 输出，控制体积以适配
// GitHub Contents API 的 1MB/文件上限，确保图片能写入当天 JSON 并正常同步。
export function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("图片解析失败"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("无法处理图片"));
        ctx.drawImage(img, 0, 0, w, h);
        // 统一输出 JPEG：保证体积控制在 GitHub Contents API 的 1MB/文件上限内，
        // 避免 PNG（尤其含透明/大图）压缩后仍超限导致图片与当天数据同步失败。
        const mime = "image/jpeg";
        try {
          resolve(canvas.toDataURL(mime, quality));
        } catch (e) {
          reject(e instanceof Error ? e : new Error("压缩失败"));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
