import {
  Gauge,
  ListChecks,
  Lightbulb,
  Calculator,
  Books,
  Smiley,
  CalendarBlank,
  Gear,
} from "@phosphor-icons/react";
import type { View } from "./BottomNav";
import { cn } from "./ui";

const ITEMS: { key: View; label: string; icon: any; hint: string }[] = [
  { key: "dashboard", label: "总览", icon: Gauge, hint: "数据看板" },
  { key: "learning", label: "学习", icon: ListChecks, hint: "学习追踪" },
  { key: "inspiration", label: "灵感", icon: Lightbulb, hint: "灵感记录" },
  { key: "assets", label: "资产", icon: Calculator, hint: "资产成本" },
  { key: "media", label: "书影", icon: Books, hint: "读书影视" },
  { key: "mood", label: "心情", icon: Smiley, hint: "精力日记" },
  { key: "review", label: "复盘", icon: CalendarBlank, hint: "月度复盘" },
  { key: "settings", label: "设置", icon: Gear, hint: "同步与配置" },
];

export default function Sidebar({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      {/* 品牌区 */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-base font-bold text-white shadow-sm shadow-teal-500/30">
          智
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight">智学</p>
          <p className="truncate text-xs text-text-2">个人工作台</p>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map((it) => {
          const active = view === it.key;
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              aria-current={active}
              title={it.hint}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-text-2 hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon size={20} weight={active ? "fill" : "regular"} />
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 底部说明 */}
      <div className="border-t border-border px-5 py-4 text-xs text-text-2">
        数据仅存于本机
      </div>
    </aside>
  );
}
