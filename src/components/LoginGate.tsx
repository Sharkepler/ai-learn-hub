import { useState } from "react";
import { motion } from "motion/react";
import { GithubLogo, Lock, Spinner } from "@phosphor-icons/react";
import { verifyToken, saveSession } from "../lib/auth";
import type { GithubUser } from "../lib/types";
import { Button, Field, inputCls } from "./ui";

export default function LoginGate({
  onLogin,
}: {
  onLogin: (u: GithubUser) => void;
}) {
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!token.trim()) return setErr("请粘贴 GitHub Token");
    setBusy(true);
    try {
      const user = await verifyToken(token.trim());
      saveSession(token.trim(), user, remember);
      onLogin(user);
    } catch (e: any) {
      if (e?.forbidden) setErr("该 GitHub 账号无权限，仅作者本人可进入");
      else if (e?.status === 401) setErr("Token 无效或无权限，请检查");
      else setErr("登录失败：网络错误或请求被拒");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-7 text-center">
          <div className="seal-mark mx-auto mb-4">
            <span>智</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">智学</h1>
          <p className="mt-1.5 text-sm text-text-2">个人 AI 学习与灵感空间</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[20px] border border-border bg-surface p-5 shadow-sm"
        >
          <Field
            label="GitHub Token"
            hint="需具备 repo 权限；用于身份校验与云端同步。仅本机保存。"
          >
            <input
              className={inputCls}
              type="password"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_... 或 github_pat_..."
            />
          </Field>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-text-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-akcent"
            />
            记住登录（本机）
          </label>

          {err && (
            <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {err}
            </p>
          )}

          <Button type="submit" block className="mt-4" disabled={busy}>
            {busy ? <Spinner /> : <GithubLogo size={18} />}
            {busy ? "校验中…" : "登录并进入"}
          </Button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-text-2">
          <Lock size={13} /> 仅授权账号可访问，数据存于你的私有仓库
        </p>
      </motion.div>
    </div>
  );
}
