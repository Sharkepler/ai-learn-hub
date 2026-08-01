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

const PAGE = 20;

type TypeFilter = "all" | "inspiration" | "learning";

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
      .replace(/[#*`>_~\-]/g, "")
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

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 多关键词高亮（AND 命中，全部标记）
function highlight(text: string, kws: string[]): ReactNode {
  if (kws.length === 0) return text;
  const re = new RegExp(`(${kws.map(escapeRe).join("|")})`, "gi");
  const parts = text.split(re);
  const set = new Set(kws.map((k) => k.toLowerCase()));
  return parts.map((p, i) =>
    set.has(p.toLowerCase()) ? (
      <mark key={i} className="rounded bg-accent-soft px-0.5 text-accent">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
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
  const [type, setType] = useState<TypeFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setType("all");
      setLimit(PAGE);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 多关键词（空格分隔，AND 匹配）
  const kws = useMemo(
    () => q.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [q]
  );

  const results = useMemo(() => {
    let res = items.filter((i) => !i.deleted);
    if (type !== "all") res = res.filter((i) => i.kind === type);
    if (kws.length)
      res = res.filter((i) => kws.every((k) => searchText(i).includes(k)));
    return res.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, type, kws]);

  const shown = results.slice(0, limit);
  const hasMore = results.length > limit;

  if (!open) return null;

  const tabs: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "inspiration", label: "灵感" },
    { key: "learning", label: "学习" },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-bg">
      <div className="border-b border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <MagnifyingGlass size={20} className="shrink-0 text-text-2" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="搜索灵感、学习记录… 多个词空格分隔"
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
        {/* 类型筛选 */}
        <div className="mx-auto flex max-w-2xl gap-2 px-4 pb-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setType(t.key);
                setLimit(PAGE);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                type === t.key
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-text-2 hover:text-accent"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {results.length === 0 ? (
            <p className="py-16 text-center text-sm text-text-2">
              没有找到匹配「{q.trim()}」的记录
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-text-2">
                共 {results.length} 条
                {q.trim() && "（已筛选）"}
              </p>
              <div className="space-y-2">
                {shown.map((it) => {
                  const d = display(it);
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
                          {highlight(d.title, kws)}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-text-2">
                          {fmtDateTime(it.createdAt)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm leading-relaxed text-text-2">
                        {highlight(d.body, kws)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {hasMore && (
                <div className="pt-2">
                  <button
                    onClick={() => setLimit((l) => l + PAGE)}
                    className="mx-auto block w-full max-w-xs rounded-full bg-surface-2 py-2.5 text-sm font-medium text-text-2 transition hover:text-accent"
                  >
                    加载更多（剩余 {results.length - limit} 条）
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
