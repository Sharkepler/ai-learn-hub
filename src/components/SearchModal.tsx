import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  X,
  MagnifyingGlass,
  Lightbulb,
  BookOpen,
} from "@phosphor-icons/react";
import { useStore } from "../state/store";
import type { Item } from "../lib/types";
import { fmtDateTime } from "../lib/util";
import { cn } from "./ui";

// 可搜索文本（用于匹配关键词）
function searchText(item: Item): string {
  if (item.kind === "inspiration") {
    return [item.text, item.tags.join(" "), item.note].join(" ").toLowerCase();
  }
  return [item.topic, item.note].join(" ").toLowerCase();
}

// 展示用标题与正文（去除少量 Markdown 噪声）
function display(item: Item): { title: string; body: string } {
  if (item.kind === "inspiration") {
    const clean = item.text
      .replace(/[#*`>_~-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title: clean.slice(0, 40) || "灵感",
      body: clean.slice(0, 160),
    };
  }
  return {
    title: item.topic,
    body: (item.topic + " " + item.note).replace(/\s+/g, " ").slice(0, 160),
  };
}

// 在文本中找到关键词并高亮（返回带 <mark> 的片段）
function highlight(text: string, kw: string): ReactNode {
  if (!kw) return text;
  const idx = text.toLowerCase().indexOf(kw.toLowerCase());
  if (idx === -1) return text;
  const start = Math.max(0, idx - 24);
  const end = Math.min(text.length, idx + kw.length + 48);
  const pre = (start > 0 ? "…" : "") + text.slice(start, idx);
  const mid = text.slice(idx, idx + kw.length);
  const post =
    text.slice(idx + kw.length, end) + (end < text.length ? "…" : "");
  return (
    <>
      {pre}
      <mark className="rounded bg-accent-soft px-0.5 text-accent">
        {mid}
      </mark>
      {post}
    </>
  );
}

export default function SearchModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: Item) => void;
}) {
  const { items } = useStore();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return [];
    return items
      .filter((i) => !i.deleted && searchText(i).includes(kw))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  }, [items, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-bg">
      <div className="border-b border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <MagnifyingGlass size={20} className="shrink-0 text-text-2" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="搜索灵感、学习记录…"
            className="flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-2/70"
          />
          <button
            onClick={onClose}
            aria-label="关闭搜索"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-2 transition hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {!q.trim() ? (
            <p className="py-16 text-center text-sm text-text-2">
              输入关键词，跨「灵感」与「学习」全局搜索
            </p>
          ) : results.length === 0 ? (
            <p className="py-16 text-center text-sm text-text-2">
              没有找到匹配「{q.trim()}」的记录
            </p>
          ) : (
            <div className="space-y-2">
              {results.map((it) => {
                const d = display(it);
                const kw = q.trim();
                return (
                  <button
                    key={it.id}
                    onClick={() => onPick(it)}
                    className="block w-full rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/40"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          it.kind === "inspiration"
                            ? "bg-accent-soft text-accent"
                            : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        )}
                      >
                        {it.kind === "inspiration" ? (
                          <Lightbulb size={12} />
                        ) : (
                          <BookOpen size={12} />
                        )}
                        {it.kind === "inspiration" ? "灵感" : "学习"}
                      </span>
                      <span className="truncate text-sm font-semibold">
                        {highlight(d.title, kw)}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-text-2">
                        {fmtDateTime(it.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-relaxed text-text-2">
                      {highlight(d.body, kw)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
