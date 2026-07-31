import { useEffect, useState } from "react";
import { ToastProvider } from "./components/Toast";
import { StoreProvider } from "./state/store";
import LoginGate from "./components/LoginGate";
import AppShell from "./components/AppShell";
import { loadSession, logout } from "./lib/auth";
import { applyTheme, getStoredTheme, watchSystem } from "./lib/theme";
import type { GithubUser } from "./lib/types";

export default function App() {
  const [user, setUser] = useState<GithubUser | null>(
    () => loadSession()?.user || null
  );

  useEffect(() => {
    applyTheme(getStoredTheme());
    return watchSystem(() => applyTheme(getStoredTheme()));
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  return (
    <ToastProvider>
      <StoreProvider>
        {user ? (
          <AppShell user={user} onLogout={handleLogout} />
        ) : (
          <LoginGate onLogin={(u) => setUser(u)} />
        )}
      </StoreProvider>
    </ToastProvider>
  );
}
