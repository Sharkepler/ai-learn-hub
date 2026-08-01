import clsx from "clsx";
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from "react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  X,
  Sparkle,
  TextB,
  TextItalic,
  TextH,
  Quotes,
  ListBullets,
  ListNumbers,
  Code,
  Link as LinkIcon,
  Eye,
} from "@phosphor-icons/react";
import * as ai from "../lib/ai";
import { renderMarkdown } from "../lib/markdown";

export const cn = (...a: (string | false | null | undefined)[]) =>
  clsx(...a);

// ---------- Card ----------
export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[16px] bg-surface border border-border p-4 shadow-[0_1px_2px_rgba(44,38,32,0.06)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------- Button ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  block?: boolean;
};
export function Button({
  variant = "primary",
  block,
  className,
  children,
  ...rest
}: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const styles: Record<string, string> = {
    primary: "bg-accent text-white hover:bg-accent-strong shadow-sm",
    ghost: "bg-transparent text-text border border-border hover:bg-surface-2",
    subtle: "bg-surface-2 text-text hover:brightness-95 dark:hover:brightness-110",
    danger: "bg-red-500 text-white hover:bg-red-600",
  };
  return (
    <button
      className={cn(base, styles[variant], block && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------- Field ----------
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-text">
        <span>{label}</span>
        {hint && <span className="text-xs font-normal text-text-2">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[15px] text-text placeholder:text-text-2/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg rounded-t-[20px] bg-surface p-5 shadow-2xl sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3 className="mb-3 text-lg font-bold tracking-tight">{title}</h3>
        )}
        {children}
      </motion.div>
    </div>
  );
}

// ---------- Lightbox (image zoom) ----------
export function Lightbox({
  src,
  onClose,
  alt,
}: {
  src: string;
  onClose: () => void;
  alt?: string;
}) {
  if (!src) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt || ""}
        className="max-h-[88vh] max-w-[92vw] cursor-zoom-out rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-3 text-xs text-white/60">点击任意处关闭</p>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
        aria-label="关闭"
      >
        <X size={20} />
      </button>
    </motion.div>
  );
}

// ---------- Spinner ----------
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

// ---------- MarkdownEditor（带格式化工具栏，无需手敲语法） ----------
type EditOp = {
  rep: string; // 替换文本
  rs: number; // 替换起点（value 内）
  re: number; // 替换终点
  sStart: number; // 新选区起点
  sEnd: number; // 新选区终点
};

// 包裹型（粗体/斜体/代码/链接）：有选区则包裹，无选区则插入占位
function surround(
  before: string,
  after: string,
  value: string,
  start: number,
  end: number,
  placeholder = "文本"
): EditOp {
  const sel = value.slice(start, end) || placeholder;
  const rep = before + sel + after;
  const sStart = start + before.length;
  const sEnd = sStart + sel.length;
  return { rep, rs: start, re: end, sStart, sEnd };
}

// 行首前缀型（标题/引用/列表）：对选中涉及到的每一行加前缀
function prefixLines(
  prefix: string,
  value: string,
  start: number,
  end: number
): EditOp {
  const ls = value.lastIndexOf("\n", start - 1) + 1;
  const block = value.slice(ls, end);
  const rep = block
    .split("\n")
    .map((l) => (l.startsWith(prefix) ? l : prefix + l))
    .join("\n");
  const delta = rep.length - block.length;
  return { rep, rs: ls, re: end, sStart: start, sEnd: end + delta };
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 100,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(true);

  function run(op: (v: string, s: number, e: number) => EditOp) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const r = op(value, start, end);
    const next = value.slice(0, r.rs) + r.rep + value.slice(r.re);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(r.sStart, r.sEnd);
    });
  }

  function insertBlock(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = value.slice(0, start);
    const needsNl = start > 0 && !before.endsWith("\n");
    const rep = (needsNl ? "\n" : "") + prefix;
    const next = before + rep + value.slice(start);
    onChange(next);
    const caret = before.length + rep.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  const tools: {
    icon: ReactNode;
    label: string;
    act: () => void;
  }[] = [
    {
      icon: <TextB size={16} />,
      label: "加粗（重点）",
      act: () => run((v, s, e) => surround("**", "**", v, s, e, "重点")),
    },
    {
      icon: <TextItalic size={16} />,
      label: "斜体",
      act: () => run((v, s, e) => surround("*", "*", v, s, e, "强调")),
    },
    {
      icon: <TextH size={16} />,
      label: "标题",
      act: () => run((v, s, e) => prefixLines("## ", v, s, e)),
    },
    {
      icon: <Quotes size={16} />,
      label: "引用",
      act: () => run((v, s, e) => prefixLines("> ", v, s, e)),
    },
    {
      icon: <ListBullets size={16} />,
      label: "无序列表",
      act: () => run((v, s, e) => prefixLines("- ", v, s, e)),
    },
    {
      icon: <ListNumbers size={16} />,
      label: "有序列表",
      act: () => run((v, s, e) => prefixLines("1. ", v, s, e)),
    },
    {
      icon: <Code size={16} />,
      label: "行内代码",
      act: () => run((v, s, e) => surround("`", "`", v, s, e, "code")),
    },
    {
      icon: <LinkIcon size={16} />,
      label: "链接",
      act: () =>
        run((v, s, e) => surround("[", "](https://)", v, s, e, "链接文字")),
    },
    {
      icon: <></>,
      label: "分割线",
      act: () => insertBlock("\n---\n"),
    },
  ];

  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25",
        className
      )}
    >
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={t.act}
            className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition hover:bg-surface-2 hover:text-accent"
          >
            {t.icon}
          </button>
        ))}
        <button
          type="button"
          title={showPreview ? "隐藏预览" : "显示预览"}
          aria-label={showPreview ? "隐藏预览" : "显示预览"}
          onClick={() => setShowPreview((p) => !p)}
          className={cn(
            "ml-auto grid h-8 w-8 place-items-center rounded-md transition",
            showPreview
              ? "bg-accent-soft text-accent"
              : "text-text-2 hover:bg-surface-2 hover:text-accent"
          )}
        >
          <Eye size={16} />
        </button>
      </div>

      {/* 编辑区 + 实时预览区（上下布局） */}
      <div className={cn("relative", showPreview && value.trim() && "divide-y divide-border")}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="block w-full resize-y bg-transparent px-3.5 py-2.5 font-mono text-[14px] leading-relaxed text-text outline-none placeholder:text-text-2/70"
        />

        {/* 实时渲染预览：有内容且开启时显示 */}
        {showPreview && value.trim() && (
          <div
            className="max-h-[40vh] overflow-auto bg-surface-2/40 px-3.5 py-2.5 font-serif text-[15px] leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(value),
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------- AiPanel (三合一 AI 辅助：打开即自动调用，可切换) ----------
export type AiKind = "summarize" | "knowledgeFrame" | "resources";

const AI_FNS: Record<AiKind, (text: string, signal: AbortSignal) => Promise<string>> = {
  summarize: ai.summarize,
  knowledgeFrame: ai.knowledgeFrame,
  resources: ai.resources,
};

const AI_TABS: [AiKind, string][] = [
  ["summarize", "总结"],
  ["knowledgeFrame", "知识框架"],
  ["resources", "资源推荐"],
];

export function AiPanel({
  source,
  initialKind = "summarize",
  autoRun = false,
}: {
  source: string;
  initialKind?: AiKind;
  autoRun?: boolean;
}) {
  const [kind, setKind] = useState<AiKind>(initialKind);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  // 调用 AI；autoRun=false 时由用户点击按钮触发，打开不自动跑
  function call(k: AiKind) {
    setKind(k);
    setBusy(true);
    setText("");
    setDone(false);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    AI_FNS[k](source, ctrl.signal)
      .then((r) => setText(r))
      .catch((e) => {
        if (e?.name === "AbortError") setText("已取消生成");
        else setText("生成失败：" + (e?.message || ""));
      })
      .finally(() => {
        setBusy(false);
        setDone(true);
      });
  }

  useEffect(() => {
    if (autoRun) call(initialKind);
    return () => {
      ctrlRef.current?.abort();
    };
  }, [source, initialKind, autoRun]);

  function cancel() {
    ctrlRef.current?.abort();
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-2">
        <Sparkle size={15} className="text-accent" /> AI 辅助
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {AI_TABS.map(([k, label]) => (
          <button
            key={k}
            disabled={busy}
            onClick={() => call(k)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-40",
              kind === k
                ? "bg-accent text-white"
                : "bg-surface text-text-2 hover:bg-surface-2"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {busy ? (
        <div className="flex items-center gap-2 py-6 text-text-2">
          <Spinner /> 生成中…
          <button
            onClick={cancel}
            className="ml-auto rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-2"
          >
            取消
          </button>
        </div>
      ) : done ? (
        <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 font-serif text-sm leading-relaxed">
          {text}
        </pre>
      ) : (
        <p className="py-6 text-center text-xs leading-relaxed text-text-2">
          点击上方按钮，让 AI 帮你
          <br />
          总结 / 梳理框架 / 推荐资源
        </p>
      )}
    </div>
  );
}

// ---------- ConfirmDialog (二次确认弹框) ----------
export function ConfirmDialog({
  open,
  title = "确认操作",
  message,
  confirmText = "确定",
  cancelText = "取消",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open onClose={onCancel} title={title}>
      <p className="text-sm leading-relaxed text-text-2">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}

// ---------- EmptyState ----------
export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-accent">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {desc && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-text-2">
          {desc}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------- Reveal (scroll-in) ----------
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
