import clsx from "clsx";
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from "react";
import { motion } from "motion/react";

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
        "rounded-[16px] bg-surface border border-border p-4",
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
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-2">{hint}</span>}
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
