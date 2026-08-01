import type { InspirationItem } from "./types";
import { fmtDateTime, ymd } from "./util";

function safeName(s: string): string {
  return (s || "")
    .replace(/[\n\r]+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
}

/** 单条灵感 → Markdown 文本 */
export function inspirationToMarkdown(item: InspirationItem): string {
  const lines: string[] = [];
  const firstLine = (item.text || "").split(/\n/)[0].trim() || "灵感";
  lines.push(`# ${firstLine}`);
  lines.push("");
  lines.push(`> 创建于 ${fmtDateTime(item.createdAt)}`);
  if (item.updatedAt !== item.createdAt) {
    lines.push(`> 更新于 ${fmtDateTime(item.updatedAt)}`);
  }
  lines.push(`> 日期：${item.day}`);
  lines.push("");
  if (item.text) lines.push(item.text);
  lines.push("");
  if (item.tags.length) {
    lines.push("## 标签");
    lines.push("");
    lines.push(item.tags.map((t) => `#${t}`).join(" "));
    lines.push("");
  }
  if (item.note) {
    lines.push("## 备注");
    lines.push("");
    lines.push(item.note);
    lines.push("");
  }
  if (item.media) {
    lines.push("## 配图");
    lines.push("");
    lines.push(`![配图](${item.media})`);
    lines.push("");
  }
  return lines.join("\n");
}

/** 多条灵感 → 合并为一个 Markdown 文档 */
export function inspirationsToMarkdown(items: InspirationItem[]): string {
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  const lines: string[] = [];
  lines.push("# 灵感导出");
  lines.push("");
  lines.push(`> 共 ${sorted.length} 条 · 导出于 ${fmtDateTime(Date.now())}`);
  if (sorted.length) {
    const days = sorted.map((i) => i.day).sort();
    lines.push(`> 时间范围：${days[days.length - 1]} ~ ${days[0]}`);
  }
  lines.push("");
  sorted.forEach((it, idx) => {
    if (idx > 0) {
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    // 合并文档里降为二级标题，避免多个一级标题
    lines.push(inspirationToMarkdown(it).replace(/^# /, "## "));
  });
  return lines.join("\n");
}

/** 触发浏览器下载一个文本文件（Markdown） */
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 单条灵感导出文件名，例如：灵感-2026-08-02-关于设计.md */
export function inspirationFileName(item: InspirationItem): string {
  const firstLine =
    ((item.text || "灵感").split(/\n/)[0].trim().slice(0, 24) || "灵感");
  return `灵感-${ymd(item.createdAt)}-${safeName(firstLine)}.md`;
}

/** 全部导出文件名，例如：灵感导出-2026-08-02.md */
export function inspirationsFileName(): string {
  return `灵感导出-${ymd(new Date())}.md`;
}
