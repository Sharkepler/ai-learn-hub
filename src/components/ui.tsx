import clsx from "clsx";
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from "react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X, Sparkle } from "@phosphor-icons/react";
import * as ai from "../lib/ai";

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
}: {
  source: string;
  initialKind?: AiKind;
}) {
  const [kind, setKind] = useState<AiKind>(initialKind);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  // 打开记录即自动调用 AI（默认总结），切换标签时再次调用
  function call(k: AiKind) {
    setKind(k);
    setBusy(true);
    setText("");
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    AI_FNS[k](source, ctrl.signal)
      .then((r) => setText(r))
      .catch((e) => {
        if (e?.name === "AbortError") setText("已取消生成");
        else setText("生成失败：" + (e?.message || ""));
      })
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    call(initialKind);
    return () => {
      ctrlRef.current?.abort();
    };
  }, [source, initialKind]);

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
      ) : (
        <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 font-serif text-sm leading-relaxed">
          {text}
        </pre>
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
