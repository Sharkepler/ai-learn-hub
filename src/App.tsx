import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ToastProvider } from "./components/Toast";
import { StoreProvider } from "./state/store";
import LoginGate from "./components/LoginGate";
import AppShell from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initSession, logout } from "./lib/auth";
import { migrateSyncCfg } from "./lib/sync";
import { applyTheme, getStoredTheme, watchSystem } from "./lib/theme";
import type { GithubUser } from "./lib/types";

function Splash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="brand-mark"
      >
        智
      </motion.div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<GithubUser | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let mounted = true;
    applyTheme(getStoredTheme());
    const unwatch = watchSystem(() => applyTheme(getStoredTheme()));
    (async () => {
      const s = await initSession(); // 解密恢复会话（需 await）
      migrateSyncCfg(); // 确保默认开启同步（修复「进页面不拉数据」）
      if (!mounted) return;
      setUser(s?.user || null);
      setBooted(true);
    })();
    return () => {
      mounted = false;
      unwatch?.();
    };
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (!booted) return <Splash />;

  return (
    <ToastProvider>
      <StoreProvider>
        <ErrorBoundary>
          {user ? (
            <AppShell user={user} onLogout={handleLogout} />
          ) : (
            <LoginGate onLogin={(u) => setUser(u)} />
          )}
        </ErrorBoundary>
      </StoreProvider>
    </ToastProvider>
  );
}
