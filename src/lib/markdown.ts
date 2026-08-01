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

/* ---------- 安全 Markdown 渲染（用于编辑/查看时高亮重点） ---------- */
// 先转义 HTML，再做有限的 Markdown 转换，避免注入；链接仅允许 http(s)/mailto。

function escHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMd(s: string): string {
  // s 已经过 escHtml；行内按序处理
  s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, t: string, url: string) => {
      const u = String(url);
      if (/^(https?:|mailto:)/i.test(u))
        return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`;
      return t;
    }
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s;
}

/** 把灵感正文渲染为安全的 HTML 字符串（子集：标题/列表/引用/代码/粗斜体/链接/分割线） */
export function renderMarkdown(src: string): string {
  const lines = (src || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let listType: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const BLOCK_START = /^(#{1,6}\s|>|[-*+]\s|\d+\.\s|```|---+$)/;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (/^```/.test(line)) {
      closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(escHtml(lines[i]));
        i++;
      }
      i++;
      out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inlineMd(escHtml(h[2]))}</h${lvl}>`);
      i++;
      continue;
    }

    // 分割线
    if (/^(---+|\*\*\*+|===+)$/.test(line.trim())) {
      closeList();
      out.push("<hr/>");
      i++;
      continue;
    }

    // 引用
    if (/^>\s?/.test(line)) {
      closeList();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(inlineMd(escHtml(lines[i].replace(/^>\s?/, ""))));
        i++;
      }
      out.push(`<blockquote>${buf.join("<br/>")}</blockquote>`);
      continue;
    }

    // 无序列表
    if (/^[-*+]\s+/.test(line)) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(
        `<li>${inlineMd(escHtml(line.replace(/^[-*+]\s+/, "")))}</li>`
      );
      i++;
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(
        `<li>${inlineMd(escHtml(line.replace(/^\d+\.\s+/, "")))}</li>`
      );
      i++;
      continue;
    }

    // 空行
    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    // 段落（合并连续非块级行）
    closeList();
    const buf: string[] = [inlineMd(escHtml(line))];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !BLOCK_START.test(lines[i])
    ) {
      buf.push(inlineMd(escHtml(lines[i])));
      i++;
    }
    out.push(`<p>${buf.join("<br/>")}</p>`);
  }
  closeList();
  return out.join("\n");
}
