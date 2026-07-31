/* ===== 云同步（基于 GitHub Contents API 的共享存储） =====
 * 数据存于一个私有仓库（默认 Sharkepler/ai-learn-hub-data）的 sync.json。
 * 手机与电脑读写同一文件即可跨设备互通。
 * 合并策略：按记录 id + updatedAt 做 last-write-wins；删除以软删除(tombstone)同步。
 */
App.sync = (function () {
  const API = "https://api.github.com";

  const state = {
    enabled: false,
    token: "",
    repo: "Sharkepler/ai-learn-hub-data",
    branch: "main",
    path: "sync.json",
    auto: true,
  };

  let _busy = false;       // 正在同步，避免并发
  let _timer = null;       // 自动同步防抖
  let _pending = false;    // 有本地改动待推送

  // 读取配置（来自本地设置）
  const reloadCfg = async () => {
    state.enabled = !!(await App.db.getSetting("syncEnabled", false));
    state.token = (await App.db.getSetting("syncToken", "")) || "";
    state.repo = (await App.db.getSetting("syncRepo", "Sharkepler/ai-learn-hub-data")) || "Sharkepler/ai-learn-hub-data";
    state.branch = (await App.db.getSetting("syncBranch", "main")) || "main";
    state.path = (await App.db.getSetting("syncPath", "sync.json")) || "sync.json";
    state.auto = await App.db.getSetting("syncAuto", true);
    return state;
  };

  const saveCfg = async (patch) => {
    if ("enabled" in patch) await App.db.setSetting("syncEnabled", !!patch.enabled);
    if ("token" in patch) await App.db.setSetting("syncToken", patch.token || "");
    if ("repo" in patch) await App.db.setSetting("syncRepo", patch.repo || "Sharkepler/ai-learn-hub-data");
    if ("branch" in patch) await App.db.setSetting("syncBranch", patch.branch || "main");
    if ("path" in patch) await App.db.setSetting("syncPath", patch.path || "sync.json");
    if ("auto" in patch) await App.db.setSetting("syncAuto", !!patch.auto);
    await reloadCfg();
  };

  // ---- 纯函数：合并两条记录集合（last-write-wins） ----
  const mergeRecords = (local, remote) => {
    const map = new Map();
    for (const r of (local || [])) if (r && r.id) map.set(r.id, r);
    for (const r of (remote || [])) {
      if (!r || !r.id) continue;
      const cur = map.get(r.id);
      if (!cur) { map.set(r.id, r); continue; }
      const cu = cur.updatedAt || cur.createdAt || 0;
      const ru = r.updatedAt || r.createdAt || 0;
      if (ru >= cu) map.set(r.id, r);
    }
    return Array.from(map.values());
  };

  // ---- 图片 Blob <-> dataURL（同步需要可序列化） ----
  const blobToDataURL = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
  const dataURLToBlob = (dataUrl) => new Promise((res) => {
    const [head, body] = dataUrl.split(",");
    const mime = (head.match(/:(.*?);/) || [, "image/png"])[1];
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    res(new Blob([arr], { type: mime }));
  });

  // 本地记录 -> 可序列化 payload（图片转 dataURL）
  const serialize = async (learnings, inspirations) => {
    const ins = await Promise.all((inspirations || []).map(async (x) => {
      const y = { ...x };
      if (x.images && x.images.length) {
        y.images = await Promise.all(x.images.map(async (im) => ({
          name: im.name, type: im.type,
          data: im.blob ? await blobToDataURL(im.blob) : im.data,
        })));
      }
      return y;
    }));
    return {
      _app: "ai-learn-hub", _ver: 1, updatedAt: Date.now(),
      learnings: learnings || [], inspirations: ins,
    };
  };

  // payload -> 本地记录（图片 dataURL 转 Blob）
  const deserialize = async (data) => {
    if (data && data.inspirations) {
      data.inspirations = await Promise.all(data.inspirations.map(async (x) => {
        if (x.images && x.images.length) {
          x.images = await Promise.all(x.images.map(async (im) => ({
            name: im.name, type: im.type,
            blob: im.data ? await dataURLToBlob(im.data) : im.blob,
          })));
        }
        return x;
      }));
    }
    return data;
  };

  // ---- base64（UTF-8 安全） ----
  const b64encode = (str) => btoa(new TextEncoder().encode(str).reduce((s, b) => s + String.fromCharCode(b), ""));
  const b64decode = (b64) => new TextDecoder().decode(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

  // ---- 网络：拉取远程 ----
  const pull = async () => {
    const res = await fetch(
      `${API}/repos/${state.repo}/contents/${state.path}?ref=${state.branch}`,
      { headers: { Authorization: "Bearer " + state.token, Accept: "application/vnd.github+json", "User-Agent": "ai-learn-hub" } });
    if (res.status === 404) return null;           // 还没有远程数据
    if (!res.ok) throw new Error(`拉取失败 HTTP ${res.status}`);
    const j = await res.json();
    const data = await deserialize(JSON.parse(b64decode(j.content)));
    return { data, sha: j.sha };
  };

  // ---- 网络：推送（带乐观锁 sha，冲突返回 conflict） ----
  const push = async (payload, sha) => {
    const body = {
      message: "sync: " + new Date().toISOString(),
      content: b64encode(JSON.stringify(payload)),
      branch: state.branch,
    };
    if (sha) body.sha = sha;
    const res = await fetch(
      `${API}/repos/${state.repo}/contents/${state.path}?ref=${state.branch}`,
      {
        method: "PUT",
        headers: { Authorization: "Bearer " + state.token, "Content-Type": "application/json",
          Accept: "application/vnd.github+json", "User-Agent": "ai-learn-hub" },
        body: JSON.stringify(body),
      });
    if (res.status === 200 || res.status === 201) {
      const j = await res.json();
      return { ok: true, sha: j.content ? j.content.sha : sha };
    }
    if (res.status === 409) return { conflict: true };
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `推送失败 HTTP ${res.status}` + (txt ? " " + txt.slice(0, 60) : "") };
  };

  // 把合并结果写回本地（抑制自动同步）
  const applyLocal = async (learnings, inspirations) => {
    await App.db.bulkPut("learnings", learnings);
    await App.db.bulkPut("inspirations", inspirations);
  };

  // ---- 一次完整同步：拉取->合并->落地->推送 ----
  const syncNow = async (opts = {}) => {
    if (_busy) return { skipped: true, reason: "busy" };
    if (!state.enabled || !state.token) { updateStatus("未配置"); return { skipped: true, reason: "not-configured" }; }
    _busy = true; updateStatus("同步中…");
    try {
      const remote = await pull();
      const [localL, localI] = await Promise.all([
        App.db.getAll("learnings"), App.db.getAll("inspirations")]);
      const mergedL = mergeRecords(localL, remote ? remote.data.learnings : []);
      const mergedI = mergeRecords(localI, remote ? remote.data.inspirations : []);
      await applyLocal(mergedL, mergedI);
      if (opts.refresh) { try { App.app.show(App.app.current || "learning"); } catch (e) {} }

      let payload = await serialize(mergedL, mergedI);
      let sha = remote ? remote.sha : null;
      let result = null;
      for (let tries = 0; tries < 2; tries++) {
        result = await push(payload, sha);
        if (result.ok) break;
        if (result.conflict) {
          const r2 = await pull();
          sha = r2 ? r2.sha : null;
          const [lL, lI] = await Promise.all([App.db.getAll("learnings"), App.db.getAll("inspirations")]);
          const mL = mergeRecords(lL, r2 ? r2.data.learnings : []);
          const mI = mergeRecords(lI, r2 ? r2.data.inspirations : []);
          await applyLocal(mL, mI);
          payload = await serialize(mL, mI);
          continue;
        }
        throw new Error(result.error);
      }
      await App.db.setMeta("lastSyncAt", Date.now());
      _pending = false;
      updateStatus("已同步");
      return { ok: true };
    } catch (e) {
      updateStatus("同步失败");
      return { ok: false, error: e.message };
    } finally {
      _busy = false;
    }
  };

  // 本地有改动 -> 防抖自动推送（仅启用且开启自动时）
  const schedulePush = () => {
    _pending = true;
    updateStatus("待同步");
    if (!state.enabled || !state.auto) return;
    clearTimeout(_timer);
    _timer = setTimeout(() => { syncNow(); }, 4000);
  };

  // 顶栏状态指示
  const updateStatus = async (override) => {
    const btn = document.getElementById("syncBtn");
    if (!btn) return;
    let label = override;
    if (!label) {
      label = state.enabled ? (_pending ? "待同步" : "已同步") : "未开启";
    }
    const last = await App.db.getMeta("lastSyncAt", null);
    const tip = state.enabled
      ? `云同步 · ${label}${last ? " · " + App.util.fmtDateTime(last) : ""}（点击立即同步）`
      : "云同步未开启，去设置开启";
    btn.title = tip;
    btn.dataset.state = state.enabled ? (override === "同步中…" ? "syncing" : (_pending ? "pending" : "ok")) : "off";
    btn.textContent = override === "同步中…" ? "🔄" : (state.enabled ? "☁️" : "🚫");
  };

  const init = async () => {
    await reloadCfg();
    updateStatus();
    if (state.enabled && state.token) {
      // 进入即拉取一次，保证新设备拿到云端数据
      const r = await syncNow({ refresh: false });
      if (r && r.ok && App.app.current) App.app.show(App.app.current);
    }
  };

  return {
    init, syncNow, schedulePush, reloadCfg, saveCfg, mergeRecords, updateStatus,
    getState: () => state,
    getLastSync: () => App.db.getMeta("lastSyncAt", null),
  };
})();
