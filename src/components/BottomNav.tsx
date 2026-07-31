import { ListChecks, Lightbulb, ChartLineUp, Gear } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { cn } from "./ui";

export type View = "learning" | "inspiration" | "dashboard" | "settings";

const ITEMS: { key: View; label: string; icon: any }[] = [
  { key: "learning", label: "学习", icon: ListChecks },
  { key: "inspiration", label: "灵感", icon: Lightbulb },
  { key: "dashboard", label: "看板", icon: ChartLineUp },
  { key: "settings", label: "设置", icon: Gear },
];

export default function BottomNav({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((it) => {
          const active = view === it.key;
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition"
              aria-current={active}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-x-3 inset-y-1 -z-10 rounded-full bg-accent-soft"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                size={22}
                weight={active ? "fill" : "regular"}
                className={cn(active ? "text-accent" : "text-text-2")}
              />
              <span className={cn(active ? "text-accent" : "text-text-2")}>
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
