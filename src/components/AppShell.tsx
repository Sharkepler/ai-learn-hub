import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import TopBar from "./TopBar";
import BottomNav, { type View } from "./BottomNav";
import Learning from "../views/Learning";
import Inspiration from "../views/Inspiration";
import Dashboard from "../views/Dashboard";
import Settings from "../views/Settings";
import { useStore, syncNow } from "../state/store";
import { applyTheme } from "../lib/theme";
import { isDarkNow } from "../lib/theme";
import type { GithubUser } from "../lib/types";
import { useToast } from "./Toast";

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
  const { lastSync, reload } = useStore();
  const toast = useToast();

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
      toast(`已同步 ${r.pushed} 天 ✅`, "ok");
      reload();
    } else {
      toast(r.error || "同步失败", "err");
    }
  }

  return (
    <div className="min-h-[100dvh]">
      <TopBar
        title={TITLES[view]}
        isDark={dark}
        onToggleTheme={toggleTheme}
        user={user}
        lastSync={lastSync}
        syncing={syncing}
        onSyncNow={handleSync}
        onLogout={onLogout}
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
            {view === "learning" && <Learning />}
            {view === "inspiration" && <Inspiration />}
            {view === "dashboard" && <Dashboard />}
            {view === "settings" && <Settings onSyncNow={handleSync} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav view={view} onChange={setView} />
    </div>
  );
}
