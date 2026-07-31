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
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
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
  return (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
