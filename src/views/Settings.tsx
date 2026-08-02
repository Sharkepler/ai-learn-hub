import { useState, useEffect } from "react";
import {
  Cloud,
  User,
  Palette,
  Info,
  GithubLogo,
  Spinner,
  Sparkle,
} from "@phosphor-icons/react";
import { Card, Button, Field, inputCls } from "../components/ui";
import { useToast } from "../components/Toast";
import { getUser, logout } from "../lib/auth";
import { getCfg, saveCfg, getLastSync } from "../lib/sync";
import { applyTheme, getStoredTheme, type Theme } from "../lib/theme";
import { fmtDateTime } from "../lib/util";
import { useStore } from "../state/store";
import { saveAiKey, loadAiKey } from "../lib/crypto";

export default function Settings({ onSyncNow }: { onSyncNow: () => void }) {
  const toast = useToast();
  const user = getUser();
  const [cfg, setCfg] = useState(getCfg());
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [saving, setSaving] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [aiSaved, setAiSaved] = useState(false);

  useEffect(() => {
    loadAiKey()
      .then(setAiKey)
      .catch(() => {});
  }, []);

  async function onSaveAiKey() {
    await saveAiKey(aiKey.trim());
    setAiSaved(true);
    toast("AI Key 已保存（加密存于本机）", "ok");
    setTimeout(() => setAiSaved(false), 2000);
  }

  function pickTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  async function save() {
    setSaving(true);
    await saveCfg(cfg);
    setLastSync(await getLastSync());
    setSaving(false);
    toast("云同步配置已保存", "ok");
    if (cfg.enabled) onSyncNow();
  }

  return (
    <div className="space-y-4">
      {/* account */}
      <Card>
        <div className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
          <User size={18} className="text-accent" /> 账号
        </div>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-surface-2 text-accent">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-bold">{user?.login.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user?.name}</p>
            <p className="truncate text-sm text-text-2">@{user?.login}</p>
          </div>
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              logout();
              location.reload();
            }}
          >
            退出
          </Button>
        </div>
      </Card>

      {/* cloud sync */}
      <Card>
        <div className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
          <Cloud size={18} className="text-accent" /> 云同步（跨设备）
        </div>
        <label className="mb-3 flex items-center justify-between">
          <span className="text-sm">启用云同步</span>
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
            className="h-5 w-5 accent-accent"
          />
        </label>
        <Field label="数据仓库（私有）" hint="GitHub 私有仓库，存放按天切分的 JSON">
          <input
            className={inputCls}
            value={cfg.repo}
            onChange={(e) => setCfg({ ...cfg, repo: e.target.value })}
            placeholder="owner/repo"
          />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="分支">
            <input
              className={inputCls}
              value={cfg.branch}
              onChange={(e) => setCfg({ ...cfg, branch: e.target.value })}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              checked={cfg.auto}
              onChange={(e) => setCfg({ ...cfg, auto: e.target.checked })}
              className="h-5 w-5 accent-accent"
            />
            自动同步
          </label>
        </div>
        <p className="mt-2 text-xs text-text-2">
          {lastSync ? `上次同步：${fmtDateTime(lastSync)}` : "尚未同步"}
        </p>
        <div className="mt-3 flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner /> : <GithubLogo size={16} />} 保存并同步
          </Button>
        </div>
      </Card>

      {/* AI 配置 */}
      <Card>
        <div className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
          <Sparkle size={18} className="text-accent" /> AI 配置
        </div>
        <p className="mb-3 text-sm leading-relaxed text-text-2">
          AI 总结 / 知识框架 / 资源推荐 需要 LongCat API Key。Key 仅加密保存在本机，仅用于调用 LongCat 接口，不会发送给任何第三方。若此前 Key 已泄露，请先在 LongCat 控制台重新生成。
        </p>
        <Field label="LongCat API Key" hint="在 LongCat 控制台获取；形如 ak_...">
          <input
            type="password"
            className={inputCls}
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder="ak_..."
          />
        </Field>
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={onSaveAiKey}>保存 Key</Button>
          {aiSaved && <span className="text-sm font-medium text-accent">已保存 ✓</span>}
        </div>
      </Card>

      {/* theme */}
      <Card>
        <div className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
          <Palette size={18} className="text-accent" /> 外观
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["light", "dark", "system"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => pickTheme(t)}
              className={
                "rounded-xl border px-3 py-2.5 text-sm font-medium transition " +
                (theme === t
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-2 hover:bg-surface-2")
              }
            >
              {t === "light" ? "浅色" : t === "dark" ? "深色" : "跟随系统"}
            </button>
          ))}
        </div>
      </Card>

      {/* about */}
      <Card>
        <div className="mb-2 flex items-center gap-2 font-semibold tracking-tight">
          <Info size={18} className="text-accent" /> 关于
        </div>
        <p className="text-sm leading-relaxed text-text-2">
          智学 · 个人 AI 学习与灵感管理工具。学习追踪、灵感记录、AI 辅助、数据看板，数据存于本机与你的私有仓库，跨设备同步。
        </p>
        <p className="mt-2 text-xs text-text-2">v2.0 · React + Tailwind v4</p>
      </Card>
    </div>
  );
}
