import { Sun, Moon, Cloud, CloudArrowUp, SignOut } from "@phosphor-icons/react";
import { useState } from "react";
import type { GithubUser } from "../lib/types";
import { fmtDateTime } from "../lib/util";
import { cn } from "./ui";

export default function TopBar({
  title,
  isDark,
  onToggleTheme,
  user,
  lastSync,
  syncing,
  onSyncNow,
  onLogout,
}: {
  title: string;
  isDark: boolean;
  onToggleTheme: () => void;
  user: GithubUser;
  lastSync: number | null;
  syncing: boolean;
  onSyncNow: () => void;
  onLogout: () => void;
}) {
  const [menu, setMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onSyncNow}
            disabled={syncing}
            title={lastSync ? `上次同步 ${fmtDateTime(lastSync)}` : "立即同步"}
            className="grid h-9 w-9 place-items-center rounded-full text-text-2 transition hover:bg-surface-2"
          >
            {syncing ? (
              <CloudArrowUp size={19} className="animate-pulse text-accent" />
            ) : (
              <Cloud size={19} />
            )}
          </button>

          <button
            onClick={onToggleTheme}
            title="切换主题"
            className="grid h-9 w-9 place-items-center rounded-full text-text-2 transition hover:bg-surface-2"
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenu((m) => !m)}
              className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-semibold text-accent"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.login}
                  className="h-full w-full object-cover"
                />
              ) : (
                user.login.slice(0, 1).toUpperCase()
              )}
            </button>
            {menu && (
              <div className="absolute right-0 top-11 w-44 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
                <div className="px-2.5 py-2">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-text-2">@{user.login}</p>
                </div>
                <button
                  onClick={onLogout}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-red-500 transition hover:bg-red-500/10"
                  )}
                >
                  <SignOut size={16} /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
