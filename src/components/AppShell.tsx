import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudArrowUp, DownloadSimple, Warning } from "@phosphor-icons/react";
import TopBar from "./TopBar";
import BottomNav, { type View } from "./BottomNav";
import Learning from "../views/Learning";
import Inspiration from "../views/Inspiration";
import Dashboard from "../views/Dashboard";
import Settings from "../views/Settings";
import SearchModal from "./SearchModal";
import { useStore, syncNow } from "../state/store";
import { applyTheme, isDarkNow } from "../lib/theme";
import { getToken } from "../lib/auth";
import { getCfg, pullAll, pollAssets } from "../lib/sync";
import type { GithubUser, Item } from "../lib/types";
import { useToast } from "./Toast";

function fmtDate() {
  const d = new Date();
  const w = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${w[d.getDay()]}`;
}

const TITLES: Record<View, string> = {
  learning: "学习追踪",
  inspiration: "灵感记录",
  dashboard: "数据看板",
  settings: "设置",
};

export default function AppShell({
  user,
  onLogout,
}: {
  user: GithubUser;
  onLogout: () => void;
}) {
  const [view, setView] = useState<View>("inspiration");
  const [dark, setDark] = useState(isDarkNow());
  const [syncing, setSyncing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // 搜索结果跳转：定位到某条记录的详情
  const [focus, setFocus] = useState<{ view: View; id: string } | null>(null);
  const { lastSync, reload } = useStore();
  const toast = useToast();

  // 进入后若已启用同步，先拉取云端全部数据（解决新设备/清空本地后看不到线上数据）
  useEffect(() => {
    if (getCfg().enabled && getToken()) {
      setSyncing(true);
      pullAll()
        .then(() => reload())
        .catch(() => {})
        .finally(() => setSyncing(false));
    }
    // 仅在挂载时执行一次
  }, []);

  // 跨设备「准实时」一致：标签页可见时每 60s 静默拉取资产并合并；
  // 切回前台时也立刻拉一次。不弹遮罩、不打扰，有变化才通知 UI 刷新。
  useEffect(() => {
    const enabled = () => getCfg().enabled && !!getToken();
    const tick = () => {
      if (document.visibilityState === "visible" && enabled()) {
        pollAssets().catch(() => {});
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    const timer = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // 仅在挂载时执行一次
  }, []);

  function toggleTheme() {
    const next = isDarkNow() ? "light" : "dark";
    applyTheme(next);
    setDark(next === "dark");
  }

  async function handleSync() {
    setSyncing(true);
    const r = await syncNow();
    setSyncing(false);
    if (r.ok) {
      toast(`已同步（拉取 ${r.pulled} 条 / 上传 ${r.pushed} 天）✅`, "ok");
      reload();
    } else {
      toast(r.error || "同步失败", "err");
    }
  }

  // 同步遮罩文案
  const syncLabel = syncing ? "正在同步数据…" : undefined;

  return (
    <div className="relative min-h-[100dvh]">
      {/* 同步全屏遮罩：防止用户在同步未完成时关闭浏览器 */}
      <AnimatePresence>
        {syncing && (
          <motion.div
            key="sync-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/70 backdrop-blur-sm"
          >
            <CloudArrowUp
              size={40}
              className="animate-spin text-accent"
              style={{ animationDuration: "1.2s" }}
            />
            <p className="mt-3 text-sm font-medium text-text-2">{syncLabel}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 蓝绿渐变页头 */}
      <header className="relative overflow-hidden rounded-b-2xl bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 px-5 pt-6 pb-5 text-white shadow-lg shadow-teal-500/20">
        {/* 装饰性光点 */}
        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-8 h-16 w-16 rounded-full bg-white/10 blur-xl" />
        <h1 className="text-xl font-bold tracking-tight">智学 · 个人学习与灵感空间</h1>
        <p className="mt-1 text-sm text-white/75">{fmtDate()} · 数据仅存于本机</p>
        {/* 操作按钮行 */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-xs font-medium backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-50"
          >
            <CloudArrowUp size={14} /> {syncing ? "同步中…" : "立即同步"}
          </button>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-xs font-medium backdrop-blur-sm transition hover:bg-white/25"
          >
            {dark ? "☀️ 浅色" : "🌙 深色"}
          </button>
          <button
            onClick={() => toast("导出功能开发中…", "ok")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-xs font-medium backdrop-blur-sm transition hover:bg-white/25"
          >
            <DownloadSimple size={14} /> 导出
          </button>
          <button
            onClick={() => {
              if (confirm("确定要清空所有本地数据吗？此操作不可撤销。"))
                toast("清空功能开发中…", "ok");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-xs font-medium backdrop-blur-sm transition hover:bg-white/25 hover:text-red-100"
          >
            <Warning size={14} /> 清空
          </button>
        </div>
      </header>

      <TopBar
        title={TITLES[view]}
        isDark={dark}
        onToggleTheme={toggleTheme}
        user={user}
        lastSync={lastSync}
        syncing={syncing}
        onSyncNow={handleSync}
        onLogout={onLogout}
        onSearch={() => setSearchOpen(true)}
      />

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {view === "learning" && (
              <Learning
                focusId={focus?.view === "learning" ? focus.id : null}
                onConsumeFocus={() => setFocus(null)}
              />
            )}
            {view === "inspiration" && (
              <Inspiration
                focusId={focus?.view === "inspiration" ? focus.id : null}
                onConsumeFocus={() => setFocus(null)}
              />
            )}
            {view === "dashboard" && <Dashboard />}
            {view === "settings" && <Settings onSyncNow={handleSync} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav view={view} onChange={setView} />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(item: Item) => {
          setView(item.kind);
          setFocus({ view: item.kind, id: item.id });
          setSearchOpen(false);
        }}
      />
    </div>
  );
}
